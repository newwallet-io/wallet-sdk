import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: false,
      exports: 'named' // Change from 'default' to 'named'
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: false
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'NewWallet',
      sourcemap: false,
      exports: 'named' // Change from 'default' to 'named'
    }
  ],
  external: [
    '@solana/web3.js',
    'ethers',
    'bn.js',
    'bs58',
    'crypto-js',
    'bip39',
    'elliptic',
    'tweetnacl',
    'rpc-websockets', // Add this
    'buffer',
    'tr46'
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    }),
    resolve(),
    commonjs(),
    terser()
  ]
};