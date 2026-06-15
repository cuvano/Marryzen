import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';
import inlineEditPlugin from './plugins/visual-editor/vite-plugin-react-inline-editor.js';
import editModeDevPlugin from './plugins/visual-editor/vite-plugin-edit-mode.js';
import iframeRouteRestorationPlugin from './plugins/vite-plugin-iframe-route-restoration.js';
import selectionModePlugin from './plugins/selection-mode/vite-plugin-selection-mode.js';

const isDev = process.env.NODE_ENV !== 'production';

// Removed Hostinger Horizons monitoring code for security/privacy

const addTransformIndexHtml = {
	name: 'add-transform-index-html',
	transformIndexHtml(html) {
		const tags = [];

		// Only add external script if explicitly configured (for production deployments)
		if (!isDev && process.env.TEMPLATE_BANNER_SCRIPT_URL && process.env.TEMPLATE_REDIRECT_URL) {
			tags.push(
				{
					tag: 'script',
					attrs: {
						src: process.env.TEMPLATE_BANNER_SCRIPT_URL,
						'template-redirect-url': process.env.TEMPLATE_REDIRECT_URL,
					},
					injectTo: 'head',
				}
			);
		}

		return {
			html,
			tags,
		};
	},
};

console.warn = () => {};

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

export default defineConfig({
	customLogger: logger,
	plugins: [
		...(isDev ? [inlineEditPlugin(), editModeDevPlugin(), iframeRouteRestorationPlugin(), selectionModePlugin()] : []),
		react(),
		addTransformIndexHtml
	],
	server: {
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: true,
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		// Bundle Z hotfix (2026-06-15): manualChunks REMOVED.
		//
		// Earlier this same date, Bundle Z added a manualChunks function that
		// split react-vendor / supabase-vendor / framer-vendor / generic vendor
		// chunks for cache-stability across deploys. That split SHIPPED BROKEN:
		// libraries like react-helmet landed in the generic `vendor` chunk and
		// referenced `React.createContext()` at module-evaluation time. Because
		// the `vendor` chunk and `react-vendor` chunk are async-loaded by the
		// browser's module loader, there's no guarantee react-vendor evaluates
		// before vendor — and on first deploy after the change, the live error
		// was: "Uncaught TypeError: Cannot read properties of undefined
		// (reading 'createContext') at vendor-5c61cada.js:19:246". React was
		// undefined because react-vendor hadn't initialized yet.
		//
		// Reverting to Rollup's auto-chunking. Rollup hoists React-dependent
		// modules into the same chunks that consume them, eliminating the
		// cross-chunk init dependency. We lose the cache-stability bonus but
		// the site works.
		//
		// Future re-attempt: use a plugin like `vite-plugin-react-vendor`
		// that handles the React init-order correctly, or configure the entry
		// to import react-vendor synchronously before any consumer code runs.
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types'
			]
		}
	}
});
