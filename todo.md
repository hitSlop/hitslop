/plan Can you review @[examples] @[packages] @[apps/apple]
  
  So right now slops get built into the single file with the vite plugin
  
  this is nice, but makes it hard to morph the slop at runtime.
  
  I wonder if there is an idea here, maybe a custom vite plugin
  
  1. instead of bundling the CSS into the single file, it essentially exists inside the slop at like .slop/assets/style.css
  and then the ai llm or user can edit it at runtime and it changes the slop
  2. people could also build "themes/skins" for these that replace the file (or a seperate file that gets applied?)
  3. right now the llm doesnt really know the schema of the json/sqlite data. I wonder if the vite plugin could handle the
  zod json schema (and maybe somehow the sqlite but that may be harder?? like maybe we define and use drizzle? or something
  more lightweight?) and then basically with vite we pull that into a schema.md or schema.json or somethnig so the llm
  knows the schema it can update????
  
  Thoughts?