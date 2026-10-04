export type Lang = 'en' | 'es'

export interface TranslationDict {
  appName: string
  rareDiseaseAtlas: string
  evidenceSupportGraph: string
  traceableSources: string
  roles: {
    family: string
    organization: string
    researcher: string
  }
  menu: {
    demo: string
    watchDemo: string
    runAgent: string
    reviewQueue: string
    communityPreview: string
    more: string
    reset: string
    stop: string
  }
  forum: {
    banner: string
    notSavedNote: string
  }
  ziva: {
    guideEyebrow: string
    ready: string
    listening: string
    thinking: string
    found: string
    uncertain: string
    greeting: string
  }
  chat: {
    emptyTitle: string
    emptySubtitle: string
    suggestions: [string, string, string]
    yourQuestion: string
    educationalDisclaimer: string
    placeholder: string
    send: string
    stepsCount: (count: number) => string
    verifiableSources: string
    nextStepTitle: string
    mechanismWarningTitle: string
    unclearTitle: string
    demoTag: string
    agentTag: string
    noMatch: string
    tryAgain: string
  }
  graph: {
    evidencePath: (nodes: number, links: number) => string
    findInGraphPlaceholder: string
    noResults: string
  }
  panels: {
    tabs: {
      evidence: string
      community: string
      missing: string
      review: string
    }
    evidence: {
      empty: string
      connection: string
      confidence: (pct: number) => string
      observed: string
      fromPaper: string
      hypothesis: string
      contributed: string
      needsReview: string
      expertReviewed: (by: string, date: string) => string
      quoteExtractedBy: (by: string) => string
      noQuoteYet: string
      contradicts: string
      close: string
    }
    community: {
      empty: string
      patientGroups: string
      companies: string
      visit: string
      cardTitle: string
      cardSubtitle: string
      cardAction: string
    }
    missing: {
      empty: string
      title: string
      notSearchedNote: string
      runAgentBtn: string
      close: string
    }
    review: {
      eyebrow: string
      title: string
      explanation: string
      viewSource: string
      noSource: string
      confirm: string
      dispute: string
      tooltip: string
      close: string
    }
  }
}

export const i18n: Record<Lang, TranslationDict> = {
  en: {
    appName: 'IluminAI',
    rareDiseaseAtlas: 'RARE DISEASE ATLAS',
    evidenceSupportGraph: 'Evidence & support graph',
    traceableSources: 'Traceable sources',
    roles: {
      family: 'Family',
      organization: 'Organization',
      researcher: 'Researcher',
    },
    menu: {
      demo: '▶ Demo',
      watchDemo: '▶ Watch demo',
      runAgent: '▶ Run agent: DEE69',
      reviewQueue: 'Review queue',
      communityPreview: 'Community (demo)',
      more: '⋯ More',
      reset: 'Reset',
      stop: 'Stop',
    },
    forum: {
      banner: 'DEMO · Illustrative posts to show how the community space will work. Not real people, organizations or medical claims.',
      notSavedNote: 'Posts are not saved in this preview.',
    },
    ziva: {
      guideEyebrow: 'YOUR EVIDENCE GUIDE',
      ready: 'Ready to explore',
      listening: 'Listening',
      thinking: 'Thinking',
      found: 'Found a path',
      uncertain: 'Not fully clear',
      greeting: "Hi, I'm Ziva",
    },
    chat: {
      emptyTitle: 'What do you want to understand today?',
      emptySubtitle: "Tell me which disease, gene or symptom you're exploring. We'll follow the evidence and look for connected support networks.",
      suggestions: [
        'Can a therapy for FHM1 be used in EA2?',
        'What groups exist for episodic ataxia type 2?',
        'What is missing for SCA6 research?',
      ],
      yourQuestion: 'YOUR QUESTION',
      educationalDisclaimer: 'Educational information. Ziva does not diagnose or replace a health professional.',
      placeholder: 'Ask Ziva about diseases, genes, mechanisms or trials…',
      send: 'Send',
      stepsCount: (c: number) => `${c} steps in the path`,
      verifiableSources: 'Verifiable sources',
      nextStepTitle: 'Next step',
      mechanismWarningTitle: 'Mechanism Warning',
      unclearTitle: "What's still unclear",
      demoTag: 'DEMO',
      agentTag: 'AGENT RUN',
      noMatch: "I couldn't find a direct match in this graph. Try CACNA1A, episodic ataxia or hemiplegic migraine.",
      tryAgain: 'Try again',
    },
    graph: {
      evidencePath: (n: number, l: number) => `● Evidence path · ${n} nodes · ${l} links`,
      findInGraphPlaceholder: 'Find in graph…',
      noResults: 'No matches found in graph',
    },
    panels: {
      tabs: {
        evidence: 'Evidence',
        community: 'Community',
        missing: "What's missing",
        review: 'Review',
      },
      evidence: {
        empty: 'Select an illuminated connection to review its source and confidence.',
        connection: 'connection',
        confidence: (pct: number) => `confidence ${pct}%`,
        observed: 'observed',
        fromPaper: 'from paper',
        hypothesis: 'hypothesis',
        contributed: 'Community contribution, pending expert review',
        needsReview: 'Needs expert review',
        expertReviewed: (by: string, date: string) => `Expert-reviewed: ${by} · ${date}`,
        quoteExtractedBy: (by: string) => `Quote extracted by ${by} · verified verbatim in abstract`,
        noQuoteYet: 'No verified quote yet: needs expert review',
        contradicts: 'Contradicts',
        close: 'Close',
      },
      community: {
        empty: 'Select a disease to see its connected patient organizations and biotech initiatives.',
        patientGroups: 'Patient organizations',
        companies: 'Biotech initiatives',
        visit: 'Visit',
        cardTitle: 'FAMILIES & PATIENTS',
        cardSubtitle: 'A shared space per disease · Voluntary connection, under your control',
        cardAction: '[In design]',
      },
      missing: {
        empty: 'Select a disease to inspect research gaps and uncharacterized variants.',
        title: "What's missing",
        notSearchedNote: 'Not found in the sources searched: OMIM, HGNC, HPO, ClinVar, PubMed, ClinicalTrials.gov, NIH RePORTER, JAX, patient-group websites. Absence here does not prove absence in reality.',
        runAgentBtn: '▶ Run research agent: DEE69',
        close: 'Close',
      },
      review: {
        eyebrow: 'HUMAN-IN-THE-LOOP',
        title: 'Waiting for expert review',
        explanation: 'Our verifier could not find a verbatim source quote for these claims, so they are hidden from the map. An expert can confirm or dispute each one.',
        viewSource: 'View source',
        noSource: 'No source link',
        confirm: 'Confirm',
        dispute: 'Dispute',
        tooltip: 'Expert sign-in coming soon',
        close: 'Close',
      },
    },
  },
  es: {
    appName: 'IluminAI',
    rareDiseaseAtlas: 'ATLAS DE ENFERMEDADES RARAS',
    evidenceSupportGraph: 'Grafo de evidencia y apoyo',
    traceableSources: 'Fuentes rastreables',
    roles: {
      family: 'Familia',
      organization: 'Organización',
      researcher: 'Investigador',
    },
    menu: {
      demo: '▶ Demo',
      watchDemo: '▶ Ver demo',
      runAgent: '▶ Ejecutar agente: DEE69',
      reviewQueue: 'Cola de revisión',
      communityPreview: 'Comunidad (demo)',
      more: '⋯ Más',
      reset: 'Reiniciar',
      stop: 'Detener',
    },
    forum: {
      banner: 'DEMO · Publicaciones ilustrativas para mostrar cómo funcionará el espacio comunitario. No son personas, organizaciones ni afirmaciones médicas reales.',
      notSavedNote: 'Las publicaciones no se guardan en esta vista previa.',
    },
    ziva: {
      guideEyebrow: 'TU GUÍA DE EVIDENCIA',
      ready: 'Lista para explorar',
      listening: 'Escuchando',
      thinking: 'Pensando',
      found: 'Ruta encontrada',
      uncertain: 'No del todo claro',
      greeting: 'Hola, soy Ziva',
    },
    chat: {
      emptyTitle: '¿Qué te gustaría entender hoy?',
      emptySubtitle: 'Dime qué enfermedad, gen o síntoma estás explorando. Seguiremos la evidencia y buscaremos redes de apoyo conectadas.',
      suggestions: [
        '¿Una terapia para FHM1 sirve en EA2?',
        '¿Qué grupos existen para la ataxia episódica tipo 2?',
        '¿Qué falta para investigar SCA6?',
      ],
      yourQuestion: 'TU PREGUNTA',
      educationalDisclaimer: 'Información educativa. Ziva no diagnostica ni reemplaza a un profesional de la salud.',
      placeholder: 'Pregúntale a Ziva sobre enfermedades, genes, mecanismos o ensayos…',
      send: 'Enviar',
      stepsCount: (c: number) => `${c} pasos en la ruta`,
      verifiableSources: 'Fuentes verificables',
      nextStepTitle: 'Siguiente paso',
      mechanismWarningTitle: 'Advertencia de mecanismo',
      unclearTitle: 'Lo que aún no está claro',
      demoTag: 'DEMO',
      agentTag: 'CORRIDA DE AGENTE',
      noMatch: 'No encontré una coincidencia directa en este grafo. Prueba con CACNA1A, ataxia episódica o migraña hemipléjica.',
      tryAgain: 'Intentar de nuevo',
    },
    graph: {
      evidencePath: (n: number, l: number) => `● Ruta de evidencia · ${n} nodos · ${l} conexiones`,
      findInGraphPlaceholder: 'Buscar en el grafo…',
      noResults: 'Sin coincidencias en el grafo',
    },
    panels: {
      tabs: {
        evidence: 'Evidencia',
        community: 'Comunidad',
        missing: 'Qué falta',
        review: 'Revisión',
      },
      evidence: {
        empty: 'Selecciona una conexión iluminada para revisar su fuente y nivel de confianza.',
        connection: 'conexión',
        confidence: (pct: number) => `confianza ${pct}%`,
        observed: 'observado',
        fromPaper: 'de artículo',
        hypothesis: 'hipótesis',
        contributed: 'Contribución de comunidad, pendiente de revisión experta',
        needsReview: 'Requiere revisión experta',
        expertReviewed: (by: string, date: string) => `Revisado por experto: ${by} · ${date}`,
        quoteExtractedBy: (by: string) => `Cita extraída por ${by} · verificada verbatim en el abstract`,
        noQuoteYet: 'Sin cita verificada aún: requiere revisión experta',
        contradicts: 'Contradice',
        close: 'Cerrar',
      },
      community: {
        empty: 'Selecciona una enfermedad para ver sus organizaciones de pacientes e iniciativas biotecnológicas conectadas.',
        patientGroups: 'Organizaciones de pacientes',
        companies: 'Iniciativas biotecnológicas',
        visit: 'Visitar',
        cardTitle: 'FAMILIAS Y PACIENTES',
        cardSubtitle: 'Un espacio compartido por enfermedad · Conexión voluntaria bajo tu control',
        cardAction: '[En diseño]',
      },
      missing: {
        empty: 'Selecciona una enfermedad para revisar huecos de investigación y variantes no caracterizadas.',
        title: 'Qué falta',
        notSearchedNote: 'No encontrado en las fuentes consultadas: OMIM, HGNC, HPO, ClinVar, PubMed, ClinicalTrials.gov, NIH RePORTER, JAX, sitios de organizaciones de pacientes. La ausencia aquí no prueba ausencia en la realidad.',
        runAgentBtn: '▶ Ejecutar agente: DEE69',
        close: 'Cerrar',
      },
      review: {
        eyebrow: 'HUMANO EN EL CICLO',
        title: 'Esperando revisión experta',
        explanation: 'Nuestro verificador no pudo hallar una cita textual de respaldo para estas afirmaciones, por lo que están ocultas del mapa. Un experto puede confirmar o disputar cada una.',
        viewSource: 'Ver fuente',
        noSource: 'Sin enlace a fuente',
        confirm: 'Confirmar',
        dispute: 'Disputar',
        tooltip: 'Acceso para expertos próximamente',
        close: 'Cerrar',
      },
    },
  },
}
