# Guía De Facilitación Del Tablero

Audiencia: llamada grupal con CONANP de 25+ personas  
Objetivo: explicar qué existe, qué está simulado, qué controla CONANP y qué requeriría el siguiente piloto operativo.

## Preparación De Un Minuto

Abrir el tablero y decir:

"Vamos a recorrer una maqueta funcional construida a partir de los archivos que CONANP envió. Lo importante no es solamente la capa visual. Debajo, los datos fueron normalizados en una estructura trazable: archivos fuente, sistemas de origen, IDs de registro, números de fila, nombres de especies, banderas de calidad y estado de revisión. Esta es una base para reducir trabajo manual de consolidación, manteniendo las decisiones científicas en manos de CONANP."

## Orden Recomendado Para Compartir Pantalla

| Tiempo | Pantalla | Qué mostrar | Mensaje |
| --- | --- | --- | --- |
| 0:00 | Tablero | Métricas superiores y franja de llamada | "Esto demuestra consolidación, no validación científica final." |
| 2:00 | Tarjetas ANP | Hacer clic en cada ANP | "El mismo modelo funciona por área protegida." |
| 4:00 | Especies | Buscar y abrir el panel lateral de una especie | "Cada taxón conserva fuentes y trazabilidad." |
| 7:00 | Revisión | Tarjetas de cola de revisión | "La incertidumbre se convierte en una cola de trabajo, no en riesgo oculto." |
| 10:00 | Trazabilidad | Línea de tiempo de un taxón de demostración | "Un revisor puede ver cómo la evidencia va del archivo a la decisión." |
| 13:00 | Sinónimos | Botón de detectar sinónimos | "Los nombres pueden proponerse para homologación sin borrar los originales." |
| 16:00 | GIS | Maqueta del mapa | "Aquí entrarían polígonos oficiales y reglas de distribución." |
| 19:00 | Automatización | Carril de tareas y reglas | "El sistema automatiza preparación repetitiva y deja aprobaciones a personas." |
| 22:00 | Pipeline | Gráfico de valor y flujo | "Así escala el proyecto hacia literatura científica y borradores de Programa." |
| 25:00 | Guía | Ligas a SVG y solicitud de cierre | "Estas son las piezas de implementación que necesitamos para avanzar." |

## Puntos Para La Página De Tablero

- Los números superiores vienen de los datos piloto, no son placeholders.
- La franja de llamada resume: qué se demostró, qué sigue siendo humano y qué viene después.
- Las tarjetas de ANP ayudan a dirección a entender que esto es repetible por área, no un ejercicio aislado de Excel.

## Puntos Para El Explorador De Especies

- La tabla de búsqueda es una interfaz funcional para un índice consolidado de especies.
- El panel lateral es la parte importante: muestra sistemas fuente, conteos de registros, trazabilidad, estado taxonómico y estado de revisión.
- No presentar la lista como final. Presentarla como una primera consolidación auditable.

## Puntos Para La Cola De Revisión

- La cola de revisión es la propuesta de valor para la fuerza laboral.
- En lugar de pedir a especialistas reconciliar hojas completas manualmente, el sistema les entrega los registros que requieren criterio.
- Los botones simulados muestran acciones futuras: validar, fusionar o asignar a especialista.

## Puntos Para Trazabilidad

- Esta vista responde: "¿de dónde salió esta afirmación?"
- Cada salida técnica debe poder regresar a archivo fuente, fila, sistema de origen y cita cuando exista.
- Es la mejor defensa frente a preocupaciones sobre IA de caja negra.

## Puntos Para Sinónimos

- El piloto usa nombres aceptados que ya vienen en las fuentes.
- La siguiente versión debería conectarse a autoridades taxonómicas como GBIF, WoRMS, CONABIO/SNIB y criterios específicos por grupo.
- Los nombres originales deben preservarse incluso cuando se proponga un nombre aceptado.

## Puntos Para GIS

- Los registros actuales tienen coordenadas y etiquetas de ANP.
- La versión operativa necesita polígonos oficiales de ANP y reglas acordadas de validación geográfica.
- Estados sugeridos: dentro, cerca del límite, fuera, incierto, sin coordenadas.

## Puntos Para Automatización

- El propósito no es automatizar decisiones finales.
- El propósito es automatizar ingesta, normalización, agrupación de duplicados, banderas de calidad y preparación de borradores.
- Toda automatización debe producir bitácora y cola de revisión.

## Puntos Para Pipeline

Usar el gráfico de valor:

1. Entra la carpeta de CONANP.
2. La ingesta clasifica el contenido.
3. La base consolida especies, registros, fuentes y banderas.
4. Especialistas revisan las partes inciertas.
5. Las salidas se convierten en tableros, reportes, paquetes GIS y borradores de texto para Programa.

## Apoyos Visuales SVG

Abrir directamente durante la llamada si ayuda:

- `assets/diagrams/database_dashboard_logistics.svg`
- `assets/diagrams/database_architecture.svg`
- `assets/diagrams/workflow_pipeline.svg`
- `assets/diagrams/human_review_loop.svg`

## Frases Fuertes Y Defendibles

- "Este es un sistema de revisión y trazabilidad, no un sistema de decisión automática."
- "La IA prepara y prioriza; CONANP aprueba."
- "Preservamos el registro original incluso cuando proponemos un valor normalizado."
- "El primer valor es reducir consolidación manual. El segundo valor es hacer cada salida defendible."
- "La incertidumbre no se oculta. Se canaliza al experto adecuado."

## Preguntas Para Hacer A CONANP

1. ¿Qué autoridades taxonómicas deben considerarse oficiales por grupo biológico?
2. ¿Puede CONANP proporcionar polígonos oficiales de ANP y reglas de límite?
3. ¿Quién debe aprobar taxonomía, geografía, citas y texto final de Programa?
4. ¿El siguiente piloto debe profundizar en las tres ANP o elegir una como ejemplo completo?
5. ¿CONANP prefiere Supabase, una base interna u otro entorno de hospedaje aprobado?

## Cierre

"El tablero busca mostrar el modelo operativo. Si CONANP está de acuerdo con el modelo, el siguiente paso es conectar polígonos oficiales, autoridades taxonómicas y un flujo de revisión para pasar de demostración a herramienta operativa."
