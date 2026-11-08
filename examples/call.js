try {
  result = format(
    source
    , { indent
      , trailingComma
      , semicolons
      , toArrow
      , filename: inputPath || "stdin.js"
      }
  );
} catch (err) {
  console.error(err);
}
