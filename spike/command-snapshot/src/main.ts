import { mount } from "svelte";
import App from "./App.svelte";
import theme from "./theme.ts";
const defaults = document.createElement("style");
defaults.textContent = theme.css; document.head.append(defaults);
mount(App, { target: document.getElementById("app")! });
