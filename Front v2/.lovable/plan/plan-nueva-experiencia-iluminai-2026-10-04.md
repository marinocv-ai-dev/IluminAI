# Plan: nueva experiencia IluminAI

## Objetivo
Reemplazar el Estudio actual por la experiencia principal de IluminAI: una entrada guiada por Ziva y un grafo de evidencia que adapta lenguaje, densidad y controles al tipo de usuario.

## Experiencia
1. **Bienvenida con Ziva**
   - Pantalla inicial breve, serena y centrada en una pregunta: “¿Qué quieres entender hoy?”.
   - Detectar el idioma del navegador y permitir cambiar entre español e inglés.
   - Si la persona aún no tiene perfil, guiarla para elegir paciente/familia, profesional de salud u organización.

2. **Perfil adaptable**
   - Guardar nombre, tipo de usuario, idioma y preferencias básicas.
   - Pacientes y familias: explicaciones sencillas, pasos guiados y evidencia resumida.
   - Profesionales y organizaciones: mayor densidad, términos clínicos, confianza, fuente y filtros visibles.
   - Permitir cambiar el modo desde la cuenta sin crear perfiles duplicados.

3. **Explorador del grafo**
   - Integrar el grafo 3D y los datos compartidos como experiencia central.
   - Búsqueda única por enfermedad, gen, síntoma o pregunta natural.
   - Ziva narra cada paso mientras el grafo ilumina nodos y conexiones.
   - Panel de evidencia con fuente, cita, nivel de confianza, contradicciones y siguiente paso.
   - Estados claros: carga, sin coincidencias, ruta parcial, sin ruta y error recuperable.

4. **Diseño adaptable**
   - Escritorio: grafo a pantalla completa con paneles laterales de recorrido y evidencia.
   - Móvil: grafo como escena principal y paneles inferiores desplegables, sin tapar la búsqueda.
   - Mantener la identidad IluminAI: azul clínico, menta para descubrimientos, Sora/Manrope y Ziva como guía, nunca como diagnóstico.

## Datos y seguridad
- Crear perfiles privados asociados a cada cuenta, con permisos para que cada persona solo vea y edite el suyo.
- Mantener el grafo inicial como archivo auditado de solo lectura.
- Adaptar las preguntas del grafo al sistema de IA seguro ya existente, sin exponer claves y validando que la IA solo ilumine identificadores presentes en el grafo.
- Retirar la funcionalidad y almacenamiento del Estudio de marca/UI de la experiencia visible; conservar los datos existentes sin borrarlos durante esta fase.

## Implementación técnica
- Portar el grafo con carga exclusiva en navegador para evitar problemas con 3D.
- Convertir la consulta de Atlas en una función autenticada de la app usando Gemini y el gateway existente.
- Reutilizar el recorte Graph-RAG del código compartido y tipar nodos, conexiones, evidencia y guiones.
- Incorporar la imagen oficial de Ziva y controles accesibles con los componentes existentes.
- Reemplazar `/estudio` por una ruta protegida del explorador y actualizar el acceso, navegación y metadatos.

## Validación
- Probar creación y edición del perfil en los tres tipos de usuario.
- Verificar la demo, una pregunta real, la narración, la iluminación y el panel de evidencia.
- Revisar escritorio y móvil, ambos idiomas, teclado, reducción de movimiento y mensajes de seguridad clínica.
- Confirmar compilación limpia y el recorrido completo con una sesión real.