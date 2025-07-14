const webpack = require("webpack");
const config = require("../webpack.config");

delete config.chromeExtensionBoilerplate;

// Increase Node.js heap size for webpack build
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

webpack(
    config,
    function (err) { if (err) throw err; }
);
