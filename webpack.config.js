module.exports = {
  resolve: {
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "events": require.resolve("events"),
      "web-streams-polyfill": require.resolve("web-streams-polyfill"),
      "http": require.resolve("react-native-http"),
      "https": require.resolve("react-native-http"),
      "crypto": require.resolve("./crypto-mock.js"),
      "zlib": require.resolve("./zlib-mock.js")
    }
  }
}; 