# 💒 Henrique & Thayna — Galeria de Fotos

Galeria colaborativa para o casamento de **Henrique & Thayna** (Março de 2027).  
Os convidados tiram fotos, deixam uma mensagem e tudo aparece na galeria para todos verem.

## Funcionalidades

- Câmera ao vivo com captura (troca frontal/traseira)
- Upload de fotos da galeria do celular
- Foto + mensagem num único card (post)
- Galeria estilo feed com foto, nome e recado
- Lightbox com legenda e download
- Fotos comprimidas automaticamente (max 1920px, JPEG 85%)
- Atualização da galeria a cada 20 segundos

## Stack

| Camada | Tecnologia |
|---|---|
| Servidor | Node.js + Express |
| Banco de dados | PostgreSQL (fotos + metadados) |
| Upload | Multer (memória) |
| Compressão | Sharp |
| Frontend demo | GitHub Pages + IndexedDB (`docs/`) |

## Rodando localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL rodando localmente

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com sua DATABASE_URL local

# 3. Iniciar servidor (cria a tabela automaticamente)
npm start
```

Acesse: `http://localhost:3000`

## Estrutura do projeto

```
├── server.js              # Entrada — inicializa DB e sobe Express
├── db/
│   ├── index.js           # Pool de conexão PostgreSQL
│   └── schema.sql         # CREATE TABLE posts (executado no boot)
├── middleware/
│   └── upload.js          # Multer — memória, filtro de imagem
├── routes/
│   ├── posts.js           # POST /api/posts, GET /api/posts, DELETE
│   └── photos.js          # GET /api/photos/:id (serve binário)
├── public/                # Frontend servido pelo Express (usa a API)
│   ├── index.html
│   ├── style.css
│   └── script.js
├── docs/                  # GitHub Pages — versão estática (IndexedDB)
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .env.example
└── package.json
```

## API

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/posts` | Lista todos os posts (sem binário) |
| `POST` | `/api/posts` | Cria post (multipart: `photo`, `name`, `message`) |
| `GET` | `/api/photos/:id` | Serve a imagem (cacheável) |
| `GET` | `/api/photos/:id/download` | Força download da imagem |
| `DELETE` | `/api/posts/:id` | Remove post |

## Deploy (Railway — recomendado)

1. Crie um projeto em [railway.app](https://railway.app)
2. Adicione um banco **PostgreSQL** pelo painel
3. Conecte o repositório GitHub
4. Configure a variável de ambiente:
   - `DATABASE_URL` → copie da aba Variables do banco Railway
   - `NODE_ENV` → `production`
5. Deploy automático a cada push em `main`

## Deploy (Render)

1. Crie um Web Service apontando para o repositório
2. Build command: `npm install`
3. Start command: `npm start`
4. Adicione um banco **PostgreSQL** no Render
5. Cole o valor de `DATABASE_URL` nas variáveis de ambiente do serviço
