SRC_DIR="./src"
METRIC_DIR="./metric"
mkdir -p "${METRIC_DIR}"

MAAIDD_CLI="bun ./src/cli/index.ts"

init(){
    # codegraph
    export CODE_GRAPH_HOOK_INDEX=on
    mkdir -p ~/.cache/code-graph/models-manual
    cd /tmp
    curl -fL -o models.tar.gz \
      https://github.com/sdsrss/code-graph-mcp/releases/download/v0.189.0/models.tar.gz
    curl -fL -o models.tar.gz.sha256 \
      https://github.com/sdsrss/code-graph-mcp/releases/download/v0.189.0/models.tar.gz.sha256
    echo "$(cat models.tar.gz.sha256)  models.tar.gz" | sha256sum -c -
    tar -xzf models.tar.gz \
      -C ~/.cache/code-graph/models-manual
    export CODE_GRAPH_MODEL_DIR="$HOME/.cache/code-graph/models-manual"
    echo 'export CODE_GRAPH_MODEL_DIR="$HOME/.cache/code-graph/models-manual"' >> ~/.bashrc
    bunx -y @sdsrs/code-graph incremental-index
    source ~/.bashrc
    # fta
    # biome
}

precommit(){
    ${MAAIDD_CLI} format "${SRC_DIR}"
    mkdir -p "${METRIC_DIR}"
    ${MAAIDD_CLI} metrics "${SRC_DIR}" --pending
}
postcommit(){
    mkdir -p "${METRIC_DIR}"
    ${MAAIDD_CLI} metrics --finalize
}

commit(){
    precommit
    git commit -m "$1"
    postcommit
}
