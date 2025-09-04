
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000; // Porta padrão 3000

// ----- CONFIGURAÇÃO -----
app.use(cors()); // Permite que seu frontend acesse o backend
app.use(express.json({ limit: '5mb' })); // Permite ao servidor receber JSON (e aumenta o limite para a imagem da assinatura)
app.use(express.static('public')); // Serve os arquivos estáticos da pasta 'public'

// ----- CONEXÃO COM O POSTGRESQL -----
// !! IMPORTANTE: Substitua pela sua string de conexão do PostgreSQL !!
// Exemplo: 'postgres://user:password@host:port/database'
const connectionString = process.env.DATABASE_URL;

console.log('>>>> MINHA CONNECTION STRING É:', connectionString); 

const pool = new Pool({
    connectionString: connectionString,
});

// ----- ROTAS DA API -----

// == CLIENTES ==
// Listar todos os clientes (com busca)
app.get('/api/clientes', async (req, res) => {
    const { q } = req.query; // q = query de busca
    try {
        let query = 'SELECT * FROM clientes ORDER BY nome ASC';
        let params = [];
        if (q) {
            query = 'SELECT * FROM clientes WHERE nome ILIKE $1 OR cpf ILIKE $1 OR escola ILIKE $1 ORDER BY nome ASC';
            params.push(`%${q}%`);
        }
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar clientes.' });
    }
});

// Cadastrar novo cliente
app.post('/api/clientes', async (req, res) => {
    const { nome, cpf, endereco, escola, telefones } = req.body;
    try {
        const query = 'INSERT INTO clientes (nome, cpf, endereco, escola, telefones) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const { rows } = await pool.query(query, [nome, cpf, endereco, escola, telefones]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
    }
});

// Atualizar cliente
app.put('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, cpf, endereco, escola, telefones } = req.body;
    try {
        const query = 'UPDATE clientes SET nome = $1, cpf = $2, endereco = $3, escola = $4, telefones = $5 WHERE id = $6 RETURNING *';
        const { rows } = await pool.query(query, [nome, cpf, endereco, escola, telefones, id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar cliente.' });
    }
});

// Apagar cliente
app.delete('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        res.status(204).send(); // 204 No Content = sucesso sem corpo de resposta
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao apagar cliente.' });
    }
});

// == PRODUTOS ==
// Listar todos os produtos
app.get('/api/produtos', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM produtos ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar produtos.' });
    }
});

// Cadastrar novo produto
app.post('/api/produtos', async (req, res) => {
    const { nome, preco, marca, estoque } = req.body;
    try {
        const query = 'INSERT INTO produtos (nome, preco, marca, estoque) VALUES ($1, $2, $3, $4) RETURNING *';
        const { rows } = await pool.query(query, [nome, preco, marca, estoque]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar produto.' });
    }
});

// Atualizar produto
app.put('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, preco, marca, estoque } = req.body;
    try {
        const query = 'UPDATE produtos SET nome = $1, preco = $2, marca = $3, estoque = $4 WHERE id = $5 RETURNING *';
        const { rows } = await pool.query(query, [nome, preco, marca, estoque, id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar produto.' });
    }
});

// Apagar produto
app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM produtos WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao apagar produto.' });
    }
});

// == VENDAS ==
app.post('/api/vendas', async (req, res) => {
    const { cliente, produtos, total, pagamento, parcelas, assinatura } = req.body;
    
    // Inicia uma transação com o banco. Ou tudo funciona, ou nada é salvo.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insere a venda na tabela 'vendas'
        const vendaQuery = 'INSERT INTO vendas (cliente_id, total, pagamento, parcelas, assinatura) VALUES ($1, $2, $3, $4, $5) RETURNING id, data_hora';
        const vendaResult = await client.query(vendaQuery, [cliente.id, total, pagamento, parcelas, assinatura]);
        const vendaId = vendaResult.rows[0].id;
        const dataVenda = new Date(vendaResult.rows[0].data_hora);

        // 2. Insere os produtos na tabela de junção 'vendas_produtos' e atualiza o estoque
        for (const produto of produtos) {
            await client.query('INSERT INTO vendas_produtos (venda_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, 1, $3)', [vendaId, produto.id, produto.preco]);
            await client.query('UPDATE produtos SET estoque = estoque - 1 WHERE id = $1', [produto.id]);
        }

        // 3. Se for crediário, insere as parcelas
        if (pagamento === 'crediario' && parcelas > 0) {
            const valorParcela = total / parcelas;
            for (let i = 1; i <= parcelas; i++) {
                const dataVencimento = new Date(dataVenda);
                dataVencimento.setMonth(dataVenda.getMonth() + i);
                await client.query('INSERT INTO parcelas_crediario (venda_id, valor, data_vencimento) VALUES ($1, $2, $3)', [vendaId, valorParcela, dataVencimento]);
            }
        }
        
        // Se tudo deu certo, confirma a transação
        await client.query('COMMIT');
        res.status(201).json({ message: 'Venda finalizada com sucesso!', vendaId: vendaId });

    } catch (err) {
        // Se algo deu errado, desfaz tudo
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Erro ao finalizar venda.' });
    } finally {
        // Libera a conexão com o banco
        client.release();
    }
});

// == HISTÓRICO E OBSERVAÇÕES ==

// Rota para buscar o histórico completo de um cliente
app.get('/api/clientes/:id/historico', async (req, res) => {
    const { id } = req.params;
    try {
        // Busca as vendas do cliente
        const vendasQuery = `
            SELECT v.*, json_agg(p.*) as produtos
            FROM vendas v
            JOIN vendas_produtos vp ON v.id = vp.venda_id
            JOIN produtos p ON vp.produto_id = p.id
            WHERE v.cliente_id = $1
            GROUP BY v.id
            ORDER BY v.data_hora DESC
        `;
        const vendasResult = await pool.query(vendasQuery, [id]);

        // Busca as parcelas de crediário de cada venda
        for (let venda of vendasResult.rows) {
            if (venda.pagamento === 'crediario') {
                const parcelasResult = await pool.query('SELECT * FROM parcelas_crediario WHERE venda_id = $1 ORDER BY data_vencimento ASC', [venda.id]);
                venda.detalheParcelas = parcelasResult.rows;
            }
        }

        // Busca as observações do cliente
        const observacoesResult = await pool.query('SELECT * FROM observacoes WHERE cliente_id = $1 ORDER BY data_hora DESC', [id]);
        
        res.json({
            vendas: vendasResult.rows,
            observacoes: observacoesResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
});

// Adicionar uma observação
app.post('/api/clientes/:id/observacoes', async (req, res) => {
    const { id } = req.params;
    const { texto } = req.body;
    try {
        const query = 'INSERT INTO observacoes (cliente_id, texto) VALUES ($1, $2) RETURNING *';
        const { rows } = await pool.query(query, [id, texto]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar observação.' });
    }
});

// Dar baixa em uma parcela
app.patch('/api/parcelas/:id/pagar', async (req, res) => {
    const { id } = req.params;
    try {
        const query = "UPDATE parcelas_crediario SET status = 'paga' WHERE id = $1 RETURNING *";
        const { rows } = await pool.query(query, [id]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao dar baixa na parcela.' });
    }
});

// ----- INICIALIZAÇÃO DO SERVIDOR -----
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});