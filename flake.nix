{
  description = "MAID — Metric Assisted AI Driven Development";

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
          maid = pkgs.writeShellApplication {
            name = "maid";
            runtimeInputs = [ pkgs.bun ];
            text = ''
              exec bun ${self}/src/cli/index.ts "$@"
            '';
          };
        in
        {
          default = {
            type = "app";
            program = "${maid}/bin/maid";
          };
        });
    };
}
