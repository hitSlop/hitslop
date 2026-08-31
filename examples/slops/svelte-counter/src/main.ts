import { mount } from 'svelte';
import { ready } from '@hitslop/runtime';
import App from './App.svelte';
import './styles.css';
mount(App, { target: document.getElementById('app')! });
ready();
