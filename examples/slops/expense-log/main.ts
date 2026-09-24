import "./styles.css";
import { mountDocument } from "@hitslop/document/host";
import App from "./App.svelte";

await mountDocument(App);
