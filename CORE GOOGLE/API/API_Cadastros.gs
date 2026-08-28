/**
 * ============================================================
 * ALMOXA PRO — API_Cadastros.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_produto(ctx) {
  return Service_Produto.get(ctx);
}

function search_produto(ctx) {
  return Service_Produto.search(ctx);
}

function create_produto(ctx) {
  return Service_Produto.create(ctx);
}

function update_produto(ctx) {
  return Service_Produto.update(ctx);
}

function get_fornecedor(ctx) {
  return Service_Fornecedor.get(ctx);
}

function search_fornecedor(ctx) {
  return Service_Fornecedor.search(ctx);
}

function create_fornecedor(ctx) {
  return Service_Fornecedor.create(ctx);
}

function update_fornecedor(ctx) {
  return Service_Fornecedor.update(ctx);
}

function API_Cadastros_getRoutes() {
  return {
    'produto.get': get_produto,
    'produto.search': search_produto,
    'produto.create': create_produto,
    'produto.update': update_produto,
    'fornecedor.get': get_fornecedor,
    'fornecedor.search': search_fornecedor,
    'fornecedor.create': create_fornecedor,
    'fornecedor.update': update_fornecedor
  };
}

function API_Cadastros_registerPermissions() {
  Auth_RBAC.registerActionPermission('produto.get', 'PRODUTO.VIEW');
  Auth_RBAC.registerActionPermission('produto.search', 'PRODUTO.VIEW');
  Auth_RBAC.registerActionPermission('produto.create', 'PRODUTO.CREATE');
  Auth_RBAC.registerActionPermission('produto.update', 'PRODUTO.EDIT');
  Auth_RBAC.registerActionPermission('fornecedor.get', 'FORNECEDOR.VIEW');
  Auth_RBAC.registerActionPermission('fornecedor.search', 'FORNECEDOR.VIEW');
  Auth_RBAC.registerActionPermission('fornecedor.create', 'FORNECEDOR.CREATE');
  Auth_RBAC.registerActionPermission('fornecedor.update', 'FORNECEDOR.EDIT');
}

