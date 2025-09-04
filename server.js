
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
    // 1. Recebemos o novo campo 'dataVenda' do corpo da requisição
    const { cliente, produtos, total, pagamento, parcelas, assinatura, dataVenda } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Usamos a data fornecida ou a data atual se nenhuma for passada
        const dataBaseParaCalculo = dataVenda ? new Date(dataVenda) : new Date();

        // 2. Inserimos a venda, mas agora usando a data correta
        const vendaQuery = 'INSERT INTO vendas (cliente_id, total, pagamento, parcelas, assinatura, data_hora) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const vendaResult = await client.query(vendaQuery, [cliente.id, total, pagamento, parcelas, assinatura, dataBaseParaCalculo]);
        const vendaId = vendaResult.rows[0].id;
        
        for (const produto of produtos) {
            await client.query('INSERT INTO vendas_produtos (venda_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, 1, $3)', [vendaId, produto.id, produto.preco]);
            await client.query('UPDATE produtos SET estoque = estoque - 1 WHERE id = $1', [produto.id]);
        }
        
        if (pagamento === 'crediario' && parcelas > 0) {
            const valorParcela = total / parcelas;
            for (let i = 1; i <= parcelas; i++) {
                // 3. A data de vencimento é calculada a partir da data da venda (e não da data atual)
                const dataVencimento = new Date(dataBaseParaCalculo);
                dataVencimento.setMonth(dataBaseParaCalculo.getMonth() + i);
                await client.query('INSERT INTO parcelas_crediario (venda_id, valor, data_vencimento) VALUES ($1, $2, $3)', [vendaId, valorParcela, dataVencimento]);
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ message: 'Venda finalizada com sucesso!', vendaId: vendaId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Erro ao finalizar venda.' });
    } finally {
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

// ROTA #1: Retorna uma lista de meses que têm parcelas pendentes
app.get('/api/dashboard/meses-disponiveis', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT date_trunc('month', data_vencimento) AS mes
            FROM parcelas_crediario
            WHERE status = 'pendente'
            ORDER BY mes ASC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar meses disponíveis.' });
    }
});

// ROTA #2: Retorna o total a receber para um mês e ano específicos
app.get('/api/dashboard/previsao-mensal', async (req, res) => {
    const { mes, ano } = req.query; // Recebe mês e ano como parâmetros. Ex: /?mes=9&ano=2025

    if (!mes || !ano) {
        return res.status(400).json({ error: 'Mês e ano são obrigatórios.' });
    }

    try {
        const query = `
            SELECT SUM(valor) as total
            FROM parcelas_crediario
            WHERE status = 'pendente' 
            AND EXTRACT(MONTH FROM data_vencimento) = $1
            AND EXTRACT(YEAR FROM data_vencimento) = $2;
        `;
        const { rows } = await pool.query(query, [mes, ano]);
        const totalReceber = rows[0].total || 0;
        res.json({ total: totalReceber });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar previsão mensal.' });
    }
});

// ROTA PARA DADOS DO DASHBOARD: CLIENTES COM PARCELAS ATRASADAS
app.get('/api/dashboard/clientes-atrasados', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT c.id, c.nome, c.telefones
            FROM clientes c
            JOIN vendas v ON c.id = v.cliente_id
            JOIN parcelas_crediario p ON v.id = p.venda_id
            WHERE p.status = 'pendente'
            AND p.data_vencimento < CURRENT_DATE;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar clientes com parcelas atrasadas.' });
    }
});

// ----- INICIALIZAÇÃO DO SERVIDOR -----
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});