# Como usar o DripTest offline

O app agora esta preparado como PWA: ele usa `manifest.webmanifest`, `service-worker.js`, cache local e `localStorage`.

## Regra importante

Para funcionar offline no dispositivo, o app precisa ser aberto pelo menos uma vez online em um contexto seguro.

Contextos aceitos:
- `https://...`
- `http://localhost`
- `http://127.0.0.1`

Em celular, abrir `http://IP-DO-PC:8000` normalmente nao registra service worker, porque nao e HTTPS. Nesse caso a pagina abre, mas o offline nao fica garantido.

## Melhor caminho para uso real

1. Publique a pasta do app em uma hospedagem HTTPS.
2. Abra a URL no celular.
3. No Chrome/Edge do celular, use `Adicionar a tela inicial` ou `Instalar app`.
4. Abra o app instalado uma vez com internet.
5. Depois disso, teste em modo aviao.

O app tambem mostra um botao `Instalar app` no cabecalho. Quando o navegador permitir, ele abre a instalacao automaticamente. Em iPhone/iPad, use o menu `Compartilhar > Adicionar a Tela de Inicio`.

Hospedagens simples para isso:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

## Teste local no computador

Na pasta do projeto:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Depois abra:

```text
http://127.0.0.1:8000/DripTeste.html
```

Para testar offline no computador:
- abra a página uma vez;
- recarregue;
- desligue o servidor;
- tente navegar de novo pelas telas.

## Arquivos essenciais para offline

- `service-worker.js`
- `manifest.webmanifest`
- `drip-data.js`
- `drip-theme.css`
- `drip-ui.js`
- `icons/icon.svg`
- `icons/icon-192.png`
- `icons/icon-512.png`
- todas as paginas `.html`

## Proximo passo para aplicativo maior

Quando o sistema ganhar banco de dados, o offline deve evoluir para:
- cache local em `IndexedDB`;
- fila de sincronizacao;
- status visual `online/offline`;
- envio automatico quando a conexao voltar.
