import { ready } from "@slop/runtime";
import { mount } from "svelte";
import App from "./App.svelte";
import "./styles.css";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app");
try {
  mount(App, { target });
} catch (error) {
  console.error("Ambient Mixer failed to mount", error);
  target.innerHTML = `<pre style="padding:24px;white-space:pre-wrap">${String(error)}</pre>`;
} finally {
  ready();
}
