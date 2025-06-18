# flake.nix
{
  description = "Development environment for NodeJS-Enterprise-APIs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      # Use the x86_64-linux system
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        # The packages to make available in the development shell
        buildInputs = with pkgs; [
          # The CI workflows specify Node.js version 20
          nodejs-20_x
        ];

        # A message to display when entering the shell
        shellHook = ''
          echo "Welcome to the NodeJS-Enterprise-APIs Nix dev shell!"
          echo "Node.js and npm are now available."
          echo ""
          echo "Next steps:"
          echo "1. If this is your first time, run 'npm install' to get project dependencies."
          echo "2. Ensure you have a '.env' file configured with the required variables."
          echo "3. Run tests with 'npm run test:esm' or 'npm run test:esm:testnet'."
        '';
      };
    };
}
