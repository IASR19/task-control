export type TourId = "lousa" | "shared";

export type TourStep = {
  // Valor do atributo data-tour do elemento destacado.
  target: string;
  title: string;
  body: string;
  // Último passo de um trecho: aponta um item real do menu, e o clique nele leva ao próximo trecho.
  navigate?: { href: string; label: string };
};

export type TourSegment = {
  // Prefixo da rota em que o trecho roda.
  route: string;
  steps: TourStep[];
};

export const TOURS: Record<TourId, TourSegment[]> = {
  lousa: [
    {
      route: "/quadro",
      steps: [
        { target: "projects", title: "Seus projetos", body: "Clique num projeto pra filtrar o quadro. O lápis renomeia, a corrente compartilha por link e o “+ projeto” cria um novo." },
        { target: "new-task", title: "Nova task", body: "Abre o editor: título, descrição com imagens, início, término, data limite, prioridade, esforço e responsáveis." },
        { target: "views", title: "Três jeitos de ver", body: "Prioridade, Lista ou Mural: as mesmas tasks, arrumadas por urgência, em lista ou por projeto, como na parede." },
        { target: "priority-col", title: "Arraste pra repriorizar", body: "Solte o card em outra coluna pra mudar a urgência. Ele fica marcado como remanejada." },
        { target: "task-card", title: "O card da task", body: "Clique pra abrir. Os chips mostram projeto, esforço, data limite e tempo; o “!” vermelho avisa atraso e os avatares mostram quem criou → responsáveis." },
        { target: "task-actions", title: "Timer e conclusão", body: "O play conta o tempo (uma task por vez). O quadrado marca como concluída e manda pro Arquivo." },
        {
          target: "nav-atividades",
          title: "Agora, Atividades",
          body: "Clique em Atividades no menu pra ver onde foi o seu tempo.",
          navigate: { href: "/atividades", label: "Atividades" },
        },
      ],
    },
    {
      route: "/atividades",
      steps: [
        { target: "periods", title: "Escolha o período", body: "Hoje, semana, mês ou datas soltas: mostra quanto tempo rodou por projeto, por dia e por task." },
        {
          target: "nav-arquivo",
          title: "Agora, Arquivo",
          body: "Clique em Arquivo no menu pra ver o que já saiu.",
          navigate: { href: "/arquivo", label: "Arquivo" },
        },
      ],
    },
    {
      route: "/arquivo",
      steps: [
        { target: "archive-tabs", title: "Histórico e sinal", body: "Fechadas lista o que foi concluído (dá pra reabrir). Sinal mostra sequência, fechadas por semana e tempo por projeto." },
        {
          target: "nav-lousa",
          title: "Agora, Foto",
          body: "Clique em Foto no menu pra trazer a lousa física pro app.",
          navigate: { href: "/lousa", label: "Foto" },
        },
      ],
    },
    {
      route: "/lousa",
      steps: [
        { target: "dropzone", title: "Foto da lousa", body: "Mande uma foto do quadro da parede. A IA monta um rascunho, você revisa e só então grava." },
        { target: "tour-button", title: "É isso", body: "Quando quiser rever, é só clicar em Tutorial aqui no topo (no celular, dentro do menu). Bom trabalho!" },
      ],
    },
  ],
  shared: [
    {
      route: "/compartilhado/",
      steps: [
        { target: "shared-head", title: "Projeto compartilhado", body: "Este projeto é de quem te convidou. Aqui você manda tasks pra ele e acompanha o andamento." },
        { target: "shared-form", title: "Mande uma task", body: "Título, descrição (pode colar imagem) e data limite opcional." },
        { target: "shared-assignees", title: "Quem cuida", body: "Escolha os responsáveis entre as pessoas do projeto. Quem cria a task já entra como responsável." },
        { target: "shared-list", title: "Tudo do projeto", body: "Abas Todas, Criei e Comigo. Cada task mostra se está na fila, em execução ou concluída." },
        { target: "shared-card", title: "Detalhes da task", body: "Clique pra abrir a descrição. Só quem criou a task pode apagar ou mudar os responsáveis." },
        { target: "workspace-switch", title: "Trocar de lousa", body: "Use este seletor pra voltar pra Minha lousa ou ir pra outros projetos compartilhados." },
      ],
    },
  ],
};

export const LOUSA_KEY = "lousa";

export function sharedKey(projectId: string) {
  return `shared:${projectId}`;
}
