<?php
/**
 * Plugin Name: Bridge Tournament Results Block
 * Description: Gutenberg block to show bridge tournament results with filters, toggles, and skeleton loading.
 * Version: 2.2
 * Requires at least: 6.2
 * Requires PHP: 8.0
 * Author: Jacek Sikora
 * Update URI: https://github.com/jsikora1/bridge-results-block
 */

require_once plugin_dir_path(__FILE__) . 'functions/results-functions.php';

function bridge_register_results_block() {
    wp_register_script('bridge-results-block-editor',plugin_dir_url(__FILE__) . 'js/block.js',['wp-blocks', 'wp-element', 'wp-editor', 'wp-components', 'wp-i18n'],time(),true);

    wp_register_style('bridge-results-block-style', plugin_dir_url(__FILE__) . 'result-styles.css',[],time());

    register_block_type('bridge/results', [
        'editor_script' => 'bridge-results-block-editor',
        'style' => 'bridge-results-block-style',
        'render_callback' => 'bridge_render_results_block',
        'attributes' => [
            'numberOfResults' => ['type' => 'number', 'default' => 10],
            'showDate' => ['type' => 'boolean', 'default' => true],
            'showTourneyType' => ['type' => 'boolean', 'default' => true],
            'filterTourneyType' => ['type' => 'string', 'default' => ''],
            'showCategory' => ['type' => 'boolean', 'default' => true],
            'showLocation' => ['type' => 'boolean', 'default' => true],
            'showImages' => ['type' => 'boolean', 'default' => true],
            'showTableHeader' => ['type' => 'boolean', 'default' => true],
            'useDefaultImage' => ['type' => 'boolean', 'default' => false],
            'defaultImageUrl' => ['type' => 'string', 'default' => ''],
            'showTournament'  => ['type' => 'boolean', 'default' => true],

        ],
    ]);
}
add_action('init', 'bridge_register_results_block');


function bridge_render_results_block($attributes) {
    $limit          = intval($attributes['numberOfResults']);
    $filterType     = sanitize_text_field($attributes['filterTourneyType'] ?? '');
    $showCategory   = !empty($attributes['showCategory']);
    $showLocation   = !empty($attributes['showLocation']);
    $showImages     = !empty($attributes['showImages']);
    $showTableHeader= !empty($attributes['showTableHeader']);
    $showTourneyType= !empty($attributes['showTourneyType']); // <-- normalize name
    $showDate       = !empty($attributes['showDate']);
    $useDefaultImage= !empty($attributes['useDefaultImage']);
    $defaultImageUrl= esc_url_raw($attributes['defaultImageUrl'] ?? '');
    $showTournament  = !empty($attributes['showTournament']);

    // Build a per-instance settings object for JS
    $settings = [
        'numberOfResults'  => $limit,
        'filterTourneyType'=> $filterType,
        'showCategory'     => (bool) $showCategory,
        'showLocation'     => (bool) $showLocation,
        'showImages'       => (bool) $showImages,
        'showTableHeader'  => (bool) $showTableHeader,
        'showTourneyType'  => (bool) $showTourneyType, // normalized for JS
        'showDate'         => (bool) $showDate,
        'useDefaultImage'  => (bool) $useDefaultImage,
        'defaultImageUrl'  => $defaultImageUrl,
        'showTournament'   => (bool) $showTournament,
    ];

// (Optional) unique id so JS can scope to this block instance if needed
    $uid = uniqid('bridge-results-');

    global $wpdb;
    $table = $wpdb->prefix . 'tourney_results';

    $query = "SELECT * FROM {$table}";
    $where = [];

    if ($filterType) {
        $where[] = $wpdb->prepare("tourney_type = %s", $filterType);
    }

    if (!empty($where)) {
        $query .= " WHERE " . implode(" AND ", $where);
    }

    $query .= " ORDER BY tourney_date DESC LIMIT %d";
    $query = $wpdb->prepare($query, $limit);

    $categories = get_categories([
        'taxonomy' => 'tribe_events_cat',
        'orderby' => 'name',
        'order' => 'ASC',
        'hide_empty' => false
    ]);

    $category_colors = [];
    foreach ($categories as $category) {
        $category_colors[$category->name] = get_term_meta($category->term_id, 'event_category_color', true);
    }

    $rows = $wpdb->get_results($query);
    $results = array_map(function($row) use ($category_colors) {
        $row = (array) $row;
        if (!empty($row['event_id'])) {
            $thumb = get_the_post_thumbnail_url($row['event_id'], 'thumbnail');
            $row['event_thumb'] = $thumb ?: '';
        } else {
            $row['event_thumb'] = '';
        }
        $row['category_color'] = $category_colors[$row['tourney_category']] ?? '#222';
        return $row;
    }, $rows);

      ob_start();
    ?>
    <div class="bridge-results-table" id="<?php echo esc_attr($uid); ?>" data-bridge-settings="<?php echo esc_attr( wp_json_encode( $settings ) ); ?>">
        <?php include plugin_dir_path(__FILE__) . 'templates/results-table.php'; ?>
    </div>
    
    <?php

    wp_enqueue_script(
        'bridge-results-js',
        plugin_dir_url(__FILE__) . 'js/results-script.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'js/results-script.js'),
        true
    );

    wp_localize_script(
        'bridge-results-js',
        'bridgeApi',
        [
            'root'  => esc_url_raw( rest_url('bridge/v1') ),
            'nonce' => wp_create_nonce('wp_rest'),
        ]
    );

    return ob_get_clean();
}