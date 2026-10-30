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
  "location": "Urca",
  "mapUrl": "https://maps.google.com/?q=...",
  "durationMin": 180,
  "bestPeriod": "afternoon",
  "costHint": "$$$",
  "sourceUrl": "https://...",
  "extraSources": ["https://..."],
  "batchId": "2026-11-02"
}
```

| Campo | Obrigatório | Valores |
| --- | --- | --- |
| `slug` | sim | minúsculas-com-hífen, único no arquivo, **nunca muda** (é o id no Firestore) |
| `title` | sim | nome curto como o grupo falaria |
| `description` | não | 1–2 frases práticas: o que é, dica útil (melhor horário, o que levar, como chegar). Sem marketing |
| `category` | sim | `praia`, `trilha`, `comida`, `passeio`, `noite`, `cultura`, `descanso` |
| `kind` | não | `activity` (padrão) ou `rest` |
| `location` | não | bairro (e endereço quando ajuda) |
| `mapUrl`, `imageUrl` | não | URL `https://` |
| `durationMin` | não | inteiro, duração típica em minutos |
| `bestPeriod` | não | `morning`, `afternoon`, `night`, `any` |
| `costHint` | não | `free`, `$`, `$$`, `$$$` (por pessoa: até ~R$50, ~R$150, acima) |
| `source` | não | `routine` (padrão) ou `curated` (cadastrado à mão por você) |
| `sourceUrl` | sim para `routine` | a melhor página que confirma o rolê |
| `extraSources` | sim para `routine` | até 5 URLs de **outros sites** que também confirmam. A validação exige pelo menos 2 domínios diferentes somando `sourceUrl` e `extraSources` |
| `batchId` | não | data do lote (`AAAA-MM-DD`) |

Valide antes de abrir PR:

```bash
cd scripts/catalog && node import.mjs --dry-run
```

## Regras da rotina de atualização

### Tamanho do lote
- Arquivo vazio ou com menos de 40 entradas: até **40** entradas novas no lote.
- Depois disso: até **15** por lote, priorizando o que falta na cobertura abaixo.

### Fontes (variedade é obrigatória)
Pesquise em vários tipos de fonte e cruze as informações. Cada rolê novo precisa de
pelo menos 2 sites diferentes que confirmem que o lugar existe e está funcionando.
No lote inteiro, nenhum domínio pode ser o `sourceUrl` de mais de 1/4 das entradas.

| Tipo | Exemplos |
| --- | --- |
| Oficiais e públicas | visit.rio, riotur.rio, prefeitura.rio, sites de parques e museus (Parque Nacional da Tijuca, Jardim Botânico, museus municipais e federais), Wikivoyage |
| Imprensa e guias locais | Veja Rio, O Globo / Rio Show, Time Out Rio, Diário do Rio, Catraca Livre, Rio Etc |
| Gastronomia e vida noturna | guias de bares e restaurantes, Comer & Beber, listas de botecos tradicionais, agendas de samba e roda |
| Viajantes e moradores | blogs de viagem, Reddit r/riodejaneiro, fóruns de trilha, Wikiloc (trilhas) |
| Agendas | eventos recorrentes (feiras, rodas de samba semanais, mercados) — só se acontecem há anos e seguem ativos |

Sites que bloqueiam leitura (TripAdvisor, Instagram, Google) podem orientar a busca,
mas não contam como fonte. Uma fonte de mais de 2 anos só vale se outra recente
confirmar que o lugar continua funcionando.

### Cobertura (seja amplo)
Cubra a cidade inteira, não só os cartões-postais:
- **Zona Sul**: Copacabana, Ipanema, Leblon, Botafogo, Urca, Flamengo, Lagoa, Jardim Botânico, Gávea, Humaitá.
- **Centro e região**: Centro histórico, Praça Mauá / Porto, Pedra do Sal, Lapa, Santa Teresa, Gamboa, Saúde.
- **Zona Norte**: Tijuca, Maracanã, Vila Isabel, São Cristóvão, Madureira, Penha, Ilha do Governador.
- **Zona Oeste**: Barra, Recreio, Prainha, Grumari, Joá, Guaratiba, Vargem Grande, Pedra de Guaratiba.
- **Ilhas**: Paquetá.

Equilibre as categorias: em um lote grande, pelo menos 4 de cada uma entre `praia`,
`trilha`, `comida`, `passeio`, `noite` e `cultura`, e algumas de `descanso`
(mirantes tranquilos, parques, programas leves para o fim do dia).

Equilibre também o perfil:
- programas grátis e baratos tanto quanto pagos;
- dia e noite;
- opções para dia de chuva (museus, centros culturais, mercados cobertos);
- clássicos (Cristo, Pão de Açúcar) **e** o que um grupo de amigos faria com um morador
  (botecos, rodas de samba, feiras, praias menos óbvias, trilhas curtas).

Fora do escopo: outras cidades (Niterói, Petrópolis, Arraial etc.), festas únicas,
lugares fechados ou "em reforma", e qualquer coisa que dependa de guia ilegal ou
área de risco sem acesso seguro.

### Conteúdo
1. Só **acrescenta** entradas ou corrige campos de entradas existentes; nunca remove
   entradas nem muda um `slug`.
2. Antes de adicionar, confere se o rolê já existe (mesmo lugar com outro nome conta
   como duplicado).
3. Nada de preços exatos, horários de funcionamento ou telefones: mudam muito.
   Use `costHint` e `bestPeriod`, e diga na descrição quando precisa reservar ou
   comprar ingresso antes.
4. Trilhas: diga o nível (leve, moderada, pesada) e se é melhor ir acompanhado de guia.
5. Abre um PR por lote. No corpo, liste cada rolê (título, categoria, bairro, fontes)
   e um resumo da cobertura: quantos por categoria e por zona da cidade.
