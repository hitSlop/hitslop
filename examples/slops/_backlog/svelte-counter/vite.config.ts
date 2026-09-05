import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

export default defineConfig({ plugins: [vanillaExtractPlugin(), svelte()] });
