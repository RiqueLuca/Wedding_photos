# 💒 Henrique & Thayna — Galeria de Fotos

Site de galeria de fotos para o casamento de **Henrique & Thayna** em Março de 2027.

Os convidados podem tirar fotos pela câmera do celular/PC, enviar da galeria, visualizar todas as fotos e fazer download.

## Funcionalidades

- Câmera ao vivo com captura de foto
- Upload de fotos da galeria
- Galeria com visualização em lightbox
- Download individual de cada foto
- Atualização automática da galeria a cada 15 segundos

## Como rodar

```bash
npm install
npm start
```

O servidor sobe em `http://localhost:3000`.

## Estrutura

```
├── server.js          # Backend Express (API de upload/listagem)
├── public/
│   ├── index.html     # Página principal
│   ├── style.css      # Estilos
│   └── script.js      # Câmera, upload, galeria
├── uploads/           # Fotos armazenadas (ignorado pelo git)
└── package.json
```

## Deploy

Para produção, configure a variável de ambiente `PORT` e certifique-se de que o diretório `uploads/` tem permissão de escrita.
