<script lang="ts">
  import Slop from "../../src/Slop.svelte";
  import * as S from "@hitslop/schema/document";
  import { createDocument } from "../../src/create-document.svelte.js";
  import { imageStore } from "../../src/image-store.svelte.js";
  const schema = S.Document({ title: S.String(), photo: S.Optional(S.Media()) });
  const recipe = createDocument({ schema, initial: { title: "Dinner" } });
  const { fields } = recipe;
  const photo = imageStore(recipe, fields.photo, { fallback: "" });
</script>

<Slop document={recipe}>
<main aria-busy={recipe.isLoading || photo.isLoading}>
  <input aria-label="Recipe title" {@attach recipe.text(fields.title)} />
  {#if photo.src}<img src={photo.src} alt={recipe.data.title} />{/if}
  <button disabled={!recipe.canWrite || photo.pending > 0} onclick={() => photo.choose()}>Choose photo</button>
  <button disabled={!recipe.canWrite || !photo.reference || photo.pending > 0} onclick={() => photo.clear()}>Remove photo</button>
  {#if photo.error}<p role="alert">{photo.error}</p><button onclick={() => photo.reload()}>Retry download</button>{/if}
</main>
</Slop>
