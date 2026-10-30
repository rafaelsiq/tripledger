# Catálogo de rolês sugeridos

Um arquivo por destino (`rio-de-janeiro.json`). Ao fazer merge na `master`, a action
`.github/workflows/catalog.yml` importa tudo para a coleção `activityCatalog` do
Firestore. O merge do PR é a revisão: entradas novas chegam como `published`.

## Formato de uma entrada

```json
{
  "slug": "bondinho-pao-de-acucar",
  "title": "Bondinho do Pão de Açúcar",
  "description": "Duas etapas de bondinho, da Praia Vermelha ao Morro da Urca e ao Pão de Açúcar. Fim de tarde rende o pôr do sol.",
  "category": "passeio",
  "kind": "activity",
  "location": "Av. Pasteur, 520 – Urca",
  "mapUrl": "https://maps.google.com/?q=...",
  "durationMin": 180,
  "bestPeriod": "afternoon",
  "costHint": "$$$",
  "sourceUrl": "https://...",
  "batchId": "2026-11-02"
}
```

| Campo | Obrigatório | Valores |
| --- | --- | --- |
| `slug` | sim | minúsculas-com-hífen, único no arquivo, **nunca muda** (é o id no Firestore) |
| `title` | sim | nome curto como o grupo falaria |
| `description` | não | 1–2 frases práticas: o que é, dica útil. Sem marketing |
| `category` | sim | `praia`, `trilha`, `comida`, `passeio`, `noite`, `cultura`, `descanso` |
| `kind` | não | `activity` (padrão) ou `rest` |
| `location` | não | bairro ou endereço |
| `mapUrl`, `imageUrl` | não | URL `https://` |
| `durationMin` | não | inteiro, duração típica em minutos |
| `bestPeriod` | não | `morning`, `afternoon`, `night`, `any` |
| `costHint` | não | `free`, `$`, `$$`, `$$$` (por pessoa: até ~R$50, ~R$150, acima) |
| `source` | não | `routine` (padrão) ou `curated` (cadastrado à mão por você) |
| `sourceUrl` | sim para `routine` | página onde a informação foi confirmada |
| `batchId` | não | data do lote (`AAAA-MM-DD`) |

Valide antes de abrir PR:

```bash
cd scripts/catalog && node import.mjs --dry-run
```

## Regras da rotina de atualização

1. Só **acrescenta** entradas ou corrige campos de entradas existentes; nunca remove
   entradas nem muda um `slug`.
2. Antes de adicionar, confere se o rolê já existe (mesmo lugar com outro nome conta
   como duplicado).
3. Cada entrada nova tem um `sourceUrl` real que foi aberto e confirma que o lugar
   existe e está funcionando. Na dúvida, não adiciona.
4. Nada de preços exatos, horários de funcionamento ou telefones: mudam muito.
   Use `costHint` e `bestPeriod`.
5. Até 10 entradas novas por lote, variando categorias. Prefira o que um grupo de
   amigos faria, não só pontos turísticos óbvios.
6. Abre um PR por lote, com a lista do que entrou e as fontes no corpo do PR.
