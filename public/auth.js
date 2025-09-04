// public/auth.js
// Este script verifica se o usuário está logado antes de carregar a página.

// A chave 'loggedIn' será salva no sessionStorage após o login bem-sucedido.
if (!sessionStorage.getItem('loggedIn')) {
    // Se a chave não existir, redireciona o usuário para a página de login.
    window.location.href = 'login.html';
}