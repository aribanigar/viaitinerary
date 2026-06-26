<?php
// PHP test script to check parameter handling
$url = "http://localhost/agencies/sample-agency/blog/sample-post?amp=1";
parse_str(parse_url($url, PHP_URL_QUERY), $query);
echo isset($query['amp']) ? "AMP found" : "AMP not found";
echo "\n";
