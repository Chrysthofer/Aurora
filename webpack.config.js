const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/renderer.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'renderer.js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      '@/components': path.resolve(__dirname, 'src/components/')
    }
  }
};