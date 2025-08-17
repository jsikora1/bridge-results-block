<?php
require __DIR__ . '/inc/puc/plugin-update-checker.php';

use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$updateChecker = PucFactory::buildUpdateChecker(
    'https://github.com/jsikora1/bridge-results-block', // public repo URL
    __FILE__,
    'bridge-results-block'                        // plugin slug (folder name)
);

// Use the branch where you tag releases (usually 'main')
$updateChecker->setBranch('main');

// Prefer Release Assets (so WP downloads the ZIP you upload to the release)
$updateChecker->getVcsApi()->enableReleaseAssets();
