/* Copyright(c) 2018-2021 Philip Mulcahy. */

const webpack = require("webpack");
const path = require("path");
const env = require("./utils/env");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const imageFileExtensions = ["jpg", "jpeg", "png", "gif", "svg"];

const chrome_extension_options = {
    target: 'web',
    mode: process.env.NODE_ENV || "development",
    entry: {
        inject: path.join(__dirname, "src", "js", "inject.ts"),
        background: path.join(__dirname, "src", "js", "background.ts"),
        control: path.join(__dirname, "src", "js", "control.ts"),
        alltests: path.join(__dirname, "src", "tests", "all.ts"),
    },
    output: {
        path: path.join(__dirname, "build"),
        filename: "[name].bundle.js"
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {compilerOptions: {outDir: "./build"}},
                    }
                ],
            },
            {
                test: /\.css$/,
                use: ['style-loader','css-loader']
            },
            {
                test: new RegExp('\\.(' + imageFileExtensions.join('|') + ')$'),
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]'
                        }
                    }
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.html$/,
                use: [
                    {
                        loader: 'html-loader'
                    }
                ],
                exclude: /node_modules/,
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        // clean the build folder
        new CleanWebpackPlugin(),
        // expose and write the allowed env vars on the compiled bundle
        new webpack.EnvironmentPlugin(["NODE_ENV"]),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "src/manifest.json",
                    transform: function (content, _path) {
                        // generates the manifest file using the package.json informations
                        return Buffer.from(
                            JSON.stringify({
                                description: process.env.npm_package_description,
                                version: process.env.npm_package_version,
                                ...JSON.parse(content.toString())
                            })
                        );
                    }
                },
                { from: "node_modules/datatables/media/css/jquery.dataTables.min.css" },
                { from: "src/html/popup.html" },
                { from: "src/img/icon128.png" },
                { from: "src/img/icon48.png" },
                { from: "src/img/sort_asc.png" },
                { from: "src/img/sort_both.png" },
                { from: "src/img/sort_desc.png" },
                { from: "src/styles/datatables_override.css" },
                { from: "src/styles/inject.css" },
                { from: "src/styles/popup.css" }
            ]
        })
    ]
};

const node_options = {
    target: 'node',
    mode: process.env.NODE_ENV || "development",
    entry: {
        nodejs_tests: path.join(__dirname, "src", "tests", "order_scraping", "order_scrape.test.ts"),
	parse_detail: path.join(__dirname, "src", "bin", "print_order_details.ts"),
    },
    output: {
        path: path.join(__dirname, "build-node"),
        filename: "[name].bundle.js"
    },
    module: {
        rules: [
            // TODO upgrade to https://webpack.js.org/guides/asset-modules/
            {
                test: new RegExp('\\.(' + imageFileExtensions.join('|') + ')$'),
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]'
                        }
                    }
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {compilerOptions: {outDir: "./build-node"}}
                    }
                ],
            },
            {
                test: /\.html$/,
                use: [
                    {
                        loader: 'html-loader',
                    }
                ],
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        alias: {},
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        // clean the build folder
        new CleanWebpackPlugin(),
        // expose and write the allowed env vars on the compiled bundle
        new webpack.EnvironmentPlugin(["NODE_ENV"]),
    ]
};

if (env.NODE_ENV === "development") {
    chrome_extension_options.devtool = "inline-source-map";
    node_options.devtool = "inline-source-map";
}

// Optimize for low memory environments
chrome_extension_options.optimization = {
    ...chrome_extension_options.optimization,
    minimize: env.NODE_ENV === "production",
    splitChunks: false,
    // Reduce memory usage during compilation
    removeAvailableModules: false,
    removeEmptyChunks: false,
    mergeDuplicateChunks: false,
};

node_options.optimization = {
    ...node_options.optimization,
    minimize: env.NODE_ENV === "production",
    splitChunks: false,
    // Reduce memory usage during compilation
    removeAvailableModules: false,
    removeEmptyChunks: false,
    mergeDuplicateChunks: false,
};

// Add memory management settings
chrome_extension_options.stats = 'errors-warnings';
chrome_extension_options.cache = false;

node_options.stats = 'errors-warnings';
node_options.cache = false;

module.exports = [chrome_extension_options, node_options];
