/**
 * function foo(a){...} → const foo = (a) => {...}
 * Plain AST nodes — no @babel/types required.
 */
function visitArray(arr, parent, key) {
  for (let i = 0; i < arr.length; i++) {
    const child = arr[i];
    if (!child || typeof child !== "object") continue;
    if (child.type === "FunctionDeclaration" && child.id && !child.generator) {
      arr[i] = {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: child.id,
            init: {
              type: "ArrowFunctionExpression",
              params: child.params,
              body: child.body,
              async: !!child.async,
              expression: child.body.type !== "BlockStatement",
              generator: false,
              id: null,
            },
          },
        ],
        declarations: undefined, // fix below
      };
      // build correctly
      arr[i] = {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: child.id,
            init: {
              type: "ArrowFunctionExpression",
              params: child.params,
              body: child.body,
              async: !!child.async,
              expression: child.body.type !== "BlockStatement",
              generator: false,
              id: null,
            },
          },
        ],
      };
      visitNode(arr[i]);
      continue;
    }
    visitNode(child);
  }
}

function visitNode(node) {
  if (!node || typeof node !== "object") return;
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end" || k === "range" || k === "extra") continue;
    const child = node[k];
    if (Array.isArray(child)) {
      visitArray(child, node, k);
    } else if (child && typeof child === "object" && child.type) {
      if (child.type === "FunctionDeclaration" && child.id && !child.generator) {
        // replace single child property
        node[k] = {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: child.id,
              init: {
                type: "ArrowFunctionExpression",
                params: child.params,
                body: child.body,
                async: !!child.async,
                expression: child.body.type !== "BlockStatement",
                generator: false,
                id: null,
              },
            },
          ],
        };
        visitNode(node[k]);
      } else {
        visitNode(child);
      }
    }
  }
}

export function applyToArrow(ast) {
  if (ast.program && Array.isArray(ast.program.body)) {
    visitArray(ast.program.body, ast.program, "body");
  }
}
