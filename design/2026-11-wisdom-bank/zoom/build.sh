#!/bin/sh
# Joins the three parts into the one page that is published. No other build step.
cd "$(dirname "$0")" && { cat head.html; echo '<script>'; cat a-data.js b-app.js; echo '</script>'; } > index.html
