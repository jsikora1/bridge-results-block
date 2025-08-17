<?php
/**
 * Keep your data function (slightly safer LIMIT)
 */


/**
 * Build a map of event category name => color hex
 */
function bridge_get_category_colors(): array {
    $cats = get_categories([
        'taxonomy'   => 'tribe_events_cat', // taxonomy for EventON or The Events Calendar categories
        'orderby'    => 'name',
        'order'      => 'ASC',
        'hide_empty' => false,
    ]);

    $map = [];
    foreach ($cats as $cat) {
        $map[$cat->name] = get_term_meta($cat->term_id, 'event_category_color', true);
    }
    return $map;
}




function get_bridge_results($limit = 10) {
    global $wpdb;
    $table = $wpdb->prefix . 'tourney_results';

    // Use prepare for LIMIT to avoid any surprises
    $results = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM {$table} ORDER BY tourney_date DESC LIMIT %d",
            absint($limit)
        )
    );

    return array_map(function($row) {
        $row = (array) $row;
        if (!empty($row['event_id'])) {
            $thumb = get_the_post_thumbnail_url($row['event_id'], 'thumbnail');
            $row['event_thumb'] = $thumb ?: '';
        } else {
            $row['event_thumb'] = '';
        }
        return $row;
    }, $results);
}

/**
 * REST API routes: /wp-json/bridge/v1/results and /search
 */
add_action('rest_api_init', function () {
    // GET /wp-json/bridge/v1/results?limit=10
    register_rest_route('bridge/v1', '/results', [
        'methods'  => 'GET',
        'callback' => 'bridge_rest_get_results',
        'permission_callback' => '__return_true', // public; tighten if needed
        'args' => [
            'limit' => [
                'type'              => 'integer',
                'default'           => 10,
                'sanitize_callback' => 'absint',
                'validate_callback' => function($value){ return $value > 0 && $value <= 100; },
            ],
        ],
    ]);

    // GET /wp-json/bridge/v1/search?keyword=foo
    register_rest_route('bridge/v1', '/search', [
        'methods'  => 'GET',
        'callback' => 'bridge_rest_search_results',
        'permission_callback' => '__return_true', // public; tighten if needed
        'args' => [
            'keyword' => [
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => function($v){ return is_string($v) && mb_strlen($v) <= 100; },
                'page'      => ['type'=>'integer','default'=>1,'sanitize_callback'=>'absint'],
                'per_page'  => ['type'=>'integer','default'=>10,'sanitize_callback'=>'absint','validate_callback'=>fn($v)=>$v>0 && $v<=100],
                'keyword'   => ['type'=>'string','required'=>false,'sanitize_callback'=>'sanitize_text_field'],
                'year'      => ['type'=>'integer','required'=>false,'sanitize_callback'=>'absint'],
                'category'  => ['type'=>'string','required'=>false,'sanitize_callback'=>'sanitize_text_field'],
                'type'      => ['type'=>'string','required'=>false,'sanitize_callback'=>'sanitize_text_field'], // tourney_type
            ],
        ],
    ]);
});

/**
 * Callbacks
 */
function bridge_rest_get_results( WP_REST_Request $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'tourney_results';

    // Pagination + filters
    $page     = max(1, (int) ($request['page'] ?? 1));
    $per_page = min(100, max(1, (int) ($request['per_page'] ?? 10)));
    $offset   = ($page - 1) * $per_page;

    $keyword  = (string) ($request['keyword']  ?? '');
    $year     = (int)    ($request['year']     ?? 0);
    $category = (string) ($request['category'] ?? '');
    $type     = (string) ($request['type']     ?? '');

    // ---- Server-side cache (transient) for the full response ----
    $cache_key = 'bridge_res_' . md5( json_encode([$page,$per_page,$keyword,$year,$category,$type]) );
    if ($cached = get_transient($cache_key)) {
        $resp = new WP_REST_Response($cached['data']);
        $resp->header('X-WP-Total',      (string)$cached['total']);
        $resp->header('X-WP-TotalPages', (string)$cached['total_pages']);
        $resp->header('Cache-Control',   'max-age=60');
        return $resp;
    }

    // Build WHERE + params
    $where   = [];
    $params  = [];

    if ($keyword !== '') {
        $where[]  = "tourney_name LIKE %s";
        $params[] = '%' . $wpdb->esc_like($keyword) . '%';
    }
    if ($year > 0) {
        $where[]  = "YEAR(tourney_date) = %d";
        $params[] = $year;
    }
    if ($category !== '') {
        $where[]  = "tourney_category = %s";
        $params[] = $category;
    }
    if ($type !== '') {
        $where[]  = "tourney_type = %s";
        $params[] = $type;
    }

    $where_sql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // ---- Count (prepare ONLY if we have placeholders) ----
    $sql_count = "SELECT COUNT(*) FROM {$table} {$where_sql}";
    if (!empty($params)) {
        $total = (int) $wpdb->get_var( $wpdb->prepare($sql_count, ...$params) );
    } else {
        $total = (int) $wpdb->get_var( $sql_count );
    }

    // ---- Data query ----
    $sql_data = "SELECT * FROM {$table} {$where_sql} ORDER BY tourney_date DESC LIMIT %d OFFSET %d";
    $rows = $wpdb->get_results(
        $wpdb->prepare($sql_data, ...array_merge($params, [$per_page, $offset]))
    );

    // ---- Category colors (cache for 60s to avoid taxonomy/meta churn) ----
    $category_colors = get_transient('bridge_cat_colors');
    if ($category_colors === false) {
        $category_colors = bridge_get_category_colors(); // your helper
        set_transient('bridge_cat_colors', $category_colors, 60);
    }

    // ---- Enrich rows (thumb + category color) ----
    $data = array_map(function($row) use ($category_colors) {
        $row = (array) $row;

        // Thumbnail (force https to avoid mixed-content)
        $thumb = (!empty($row['event_id']))
            ? (get_the_post_thumbnail_url($row['event_id'], 'thumbnail') ?: '')
            : '';
        if ($thumb) { $thumb = set_url_scheme($thumb, 'https'); }
        $row['event_thumb'] = $thumb;

        // Category color with neutral fallback
        $row['category_color'] = $category_colors[$row['tourney_category']] ?? '#ccc';

        return $row;
    }, $rows);

    // ---- Response + headers ----
    $total_pages = (int) ceil($total / max(1, $per_page));

    $resp = new WP_REST_Response($data);
    $resp->header('X-WP-Total',      (string)$total);
    $resp->header('X-WP-TotalPages', (string)$total_pages);
    $resp->header('Cache-Control',   'max-age=60');

    // Save full response in transient for 60s
    set_transient($cache_key, [
        'data'        => $data,
        'total'       => $total,
        'total_pages' => $total_pages,
    ], 60);

    return $resp;
}

function bridge_rest_search_results( WP_REST_Request $request ) {
    global $wpdb;
    $keyword = $request->get_param('keyword');
    $table   = $wpdb->prefix . 'tourney_results';

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM {$table} WHERE tourney_name LIKE %s ORDER BY tourney_date DESC LIMIT 100",
            '%' . $wpdb->esc_like($keyword) . '%'
        )
    );

    $results = array_map(function($row) {
        $row = (array) $row;
        $row['event_thumb'] = !empty($row['event_id'])
            ? (get_the_post_thumbnail_url($row['event_id'], 'thumbnail') ?: '')
            : '';
        return $row;
    }, $rows);

    return rest_ensure_response($results);
}

/**
 * --- Removed old admin-ajax handler ---
 *
 * // add_action('wp_ajax_search_bridge_results', 'ajax_search_bridge_results');
 * // function ajax_search_bridge_results() { ... }
 */
