{
  description = "Wider-style JavaScript/TypeScript formatter";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          formatter = pkgs.writeShellApplication {
            name = "wider-format";
            runtimeInputs = [ pkgs.bun ];
            text = ''
              exec bun ${self}/src/cli.js "$@"
            '';
          };
        in
        {
          default = {
            type = "app";
            program = "${formatter}/bin/wider-format";
          };
        });
    };
}
