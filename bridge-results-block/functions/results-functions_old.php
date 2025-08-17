<?php
function get_bridge_results($limit = 10) {
    global $wpdb;
    $table = $wpdb->prefix . 'tourney_results';
    $results = $wpdb->get_results("SELECT * FROM {$table} ORDER BY tourney_date DESC LIMIT " . intval($limit));
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



add_action('wp_ajax_search_bridge_results', 'ajax_search_bridge_results');
function ajax_search_bridge_results() {
    check_ajax_referer('bridge_results_nonce', 'security');

    global $wpdb;
    $keyword = sanitize_text_field($_POST['keyword']);
    $table = $wpdb->prefix . 'tourney_results';

    $results = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM $table WHERE tourney_name LIKE %s ORDER BY tourney_date DESC LIMIT 100",
            '%' . $wpdb->esc_like($keyword) . '%'
        )
    );

    // Map thumbnails, etc.
    $results = array_map(function($row) {
        $row = (array) $row;
        if (!empty($row['event_id'])) {
            $row['event_thumb'] = get_the_post_thumbnail_url($row['event_id'], 'thumbnail') ?: '';
        } else {
            $row['event_thumb'] = '';
        }
        return $row;
    }, $results);

    wp_send_json_success($results);
}


