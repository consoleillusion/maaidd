/**
 * Transform: convert function declarations to const arrow functions.
 *
 *   function foo(a, b) { ... }
 *   →
 *   const foo = (a, b) => { ... }
 */
type Node = any;

function isTopLevel(decl: Node): boolean {
  return (
    decl.type === "FunctionDeclaration" &&
    decl.id !== null &&
    decl.id !== undefined
  );
}

export function applyToArrow(ast: Node): void {
  if (!ast || typeof ast !== "object") return;

  const walk = (node: Node): void => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }

    if (Array.isArray(node.body)) {
      const body = node.body;
      for (let i = 0; i < body.length; i++) {
        const decl = body[i];
        if (isTopLevel(decl)) {
          body[i] = {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: decl.id,
                init: {
                  type: "ArrowFunctionExpression",
                  params: decl.params ?? [],
                  body: decl.body,
                  async: decl.async ?? false,
                  generator: false,
                  leadingComments: decl.leadingComments,
                  trailingComments: decl.trailingComments,
                },
                leadingComments: decl.leadingComments,
                trailingComments: decl.trailingComments,
              },
            ],
          };
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc" || key === "start" || key === "end") {
        continue;
      }
      const child = node[key];
      if (child && typeof child === "object") {
        walk(child);
      }
    }
  };

  walk(ast);
}