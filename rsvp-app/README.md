# RSVP App

## Bodas, invitados y acceso para novios

- En `/weddings`, cada boda permite copiar la invitación pública y crear/copiar
  el acceso privado de los novios. **Renovar enlace** invalida el acceso anterior.
- El portal `/couple/...` permite gestionar únicamente esa boda: invitados y
  acompañantes, información del evento, publicación y formulario RSVP.
- Los novios ven un listado compacto con búsqueda por nombre, acompañante,
  teléfono o email; filtros por respuesta RSVP y acompañantes; y **Editar** para
  desplegar los formularios de una invitación. Los filtros se conservan al guardar.
- En **Invitados**, edita el cupo de acompañantes, añade sus nombres o elimina
  invitados. Eliminar un principal también elimina sus acompañantes y RSVPs.
- **Agregar invitado** abre un modal con nombre obligatorio, email y teléfono
  opcionales. La validación se aplica en navegador y servidor. El teléfono permite
  elegir código de país, se formatea para leerlo y se guarda normalizado.
- En el modal, **Agregar acompañante** añade un campo numerado por persona; cada
  campo puede quitarse. Si quedan campos vacíos, aparece un aviso con **Completar
  nombres** y **Crear de todas formas**. Al continuar, se reservan esos lugares en
  `max_seats`; solo los acompañantes con nombre generan registros. El invitado
  principal y sus acompañantes se crean en una sola inserción. Los espacios sin
  nombre pueden completarse opcionalmente desde el RSVP personal.
- Cada invitado principal tiene su propio enlace. **Copiar invitación** está visible
  en cada fila de **Invitados**, sin abrir **Editar**. El enlace identifica al invitado
  automáticamente; su nombre aparece al inicio y nunca se le pide escribir un código.
  Si un invitado antiguo todavía no tiene enlace, el mismo botón lo genera y copia.
- Cada fila tiene **Compartir**: menú nativo del dispositivo, cuando está disponible,
  u opciones para WhatsApp, email y copiar el mensaje de invitación.
- Las casillas permiten seleccionar personas, todos los visibles o toda la lista.
  La selección se conserva al filtrar y avisa cuántos seleccionados están fuera
  del filtro. Las acciones por lote son **Copiar enlaces** y **Compartir**; se
  preparan enlaces personales distintos y se generan los que falten para invitados
  antiguos. **Limpiar selección** quita todas las marcas.
- La información y las preguntas configuradas se muestran en `/i/:slug` y en su
  formulario de confirmación. Cambiar el título conserva el enlace de la boda.

El servidor necesita `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` (o
`PUBLIC_SUPABASE_URL`). Estas variables ya se usan en el entorno local; configúralas
también en Netlify. La clave de servicio nunca lleva prefijo `PUBLIC_`.
Opcionalmente, configura `COUPLE_ACCESS_SECRET` para firmar los enlaces con una
clave independiente; si no existe, se usa la clave de servicio con un contexto
de firma propio. Cambiar la clave de firma invalida los enlaces existentes.
No se necesitan migraciones: la versión revocable del acceso y los detalles del
evento se guardan en `weddings.settings`; la firma se genera solo en el servidor.

Para compartir enlaces fuera del ordenador, abre la aplicación desde su dominio
desplegado. Los botones copian el dominio desde el que estés accediendo.

## Templates de invitación

En `/weddings`, pulsa **Templates** junto a **Gestionar invitados**. La biblioteca
de cada boda está en `/weddings/:id/templates` y permite previsualizar o activar
**Clásico**, **Floral Romance** y **Seda & Promesas**. La vista previa funciona también en borradores;
su formulario usa un invitado de ejemplo y no guarda respuestas reales.

La selección se almacena en el campo existente `weddings.theme_id` y solo cambia
la presentación de `/i/:slug` y `/i/:slug/rsvp`. No cambia el dashboard, el portal
de los novios, los detalles de la boda, los invitados ni las confirmaciones.
Las bodas existentes y los identificadores desconocidos usan el diseño clásico.
No se necesitan migraciones ni dependencias nuevas.

### Seda & Promesas

Identificador: `seda_promesas`. Se activa desde la biblioteca existente, con su
miniatura y vista previa independiente. Reproduce la secuencia vertical de la
referencia de seda: corazón con encaje y nombres, bienvenida y calendario sobre
papel ovalado, ubicación en marco rococó, programa en marco moldeado, RSVP ovalado,
firma de los novios, cuenta regresiva y arreglos florales en jarrones.

Usa las nueve variables `--wedding-*` de la paleta oficial, tela marfil fotográfica
CC0, velos superpuestos, follaje y flores blancas, con matices pastel en molduras y
detalles botánicos. Los recursos se sirven localmente y sus fuentes figuran en
`public/templates/seda-promesas/ARTWORK.md`.

El nombre del invitado permanece al inicio. La confirmación reutiliza el formulario
personal con casillas para acompañantes y botones **Asistir** / **No asistir**.
No exige introducir un código. La vista previa mantiene bloqueado el envío real.

Toda la información procede de los campos existentes de la boda. El calendario
usa su fecha real. El programa admite la lista dinámica de actividades y recurre
a ceremonia/recepción si no existe una lista personalizada. Se conserva el orden
del itinerario, incluyendo actividades de madrugada. Cada ubicación configurada
tiene su propio marco y enlace al mapa. Sin datos se omiten estas composiciones.

La cuenta regresiva utiliza la fecha, la hora de ceremonia (o la primera actividad /
recepción disponible) y la zona horaria de la boda. Sin horario se cuenta hasta el
inicio del día de la boda. Sin fecha válida se omite; pasada la fecha, se detiene en
cero. No se muestran cifras ficticias. Los nombres largos y los programas extensos
se acomodan sin estirar los remates ornamentales.

Regalos, vestimenta, contacto e información adicional aparecen únicamente cuando
están configurados. La fotografía principal no se presenta en este diseño: la
portada sigue el corazón tipográfico de la referencia. Los colores de vestimenta
siguen siendo los elegidos para esa boda.

Floral Romance presenta una invitación vertical continua: sobre de papel con
solapas diagonales, encaje y sello; portada ovalada; bienvenida salvia; calendario
en un sobre abierto; itinerario ilustrado; ubicación con grabado arquitectónico;
mesa de regalos sobre papel inclinado; vestimenta con encaje; y formulario RSVP
integrado. El formulario independiente también conserva este diseño.

Utiliza la paleta oficial, Pinyon Script y Cormorant Garamond desde Google Fonts
con fuentes de respaldo. Sus animaciones respetan `prefers-reduced-motion`;
el sobre también abre con teclado y sin JavaScript. El ancho editorial se limita
a 720 px en escritorio, sin convertir las secciones en tarjetas horizontales.

### Contenido de Floral Romance

Los campos nuevos se editan en **Información de la boda** y se guardan en el
JSON existente `weddings.settings`, sin tablas, relaciones ni migraciones nuevas:

- `main_photo_url`, `main_photo_alt`: fotografía real de la boda y descripción.
- `itinerary`: lista ordenada de `{ time, title, description }`. El editor acepta
  una actividad por línea: `HH:MM | Nombre | Descripción`. Admite hasta 30 y
  conserva el orden, incluso cuando la celebración continúa después de medianoche.
- `gifts_message`, `gifts_label`, `gifts_url`: mensaje, tienda y enlace. El campo
  `gifts` existente conserva la información de regalos o los datos bancarios.
- `dress_recommendations`, `dress_restrictions`, `dress_examples_url` y
  `dress_colors`: recomendaciones, restricciones, enlace y hasta 12 colores HEX.
  La paleta de vestimenta se elige por boda; nunca se rellena con los cinco
  colores del template. Los figurines son únicamente ilustraciones decorativas.

Comportamientos cuando faltan datos:

- Sin foto: monograma en el marco de encaje, sin una fotografía de sustitución.
- Sin fecha: se omiten la fecha y el calendario. El calendario usa la fecha local
  de la boda, semana de lunes a domingo y duración real del mes (incluidos bisiestos).
- Sin itinerario personalizado: se muestran las actividades con horario de los
  campos existentes de ceremonia y recepción. Si no hay horarios, se omite.
- Sin mensaje de bienvenida, ubicación, regalos o vestimenta: se omite la sección
  correspondiente. Los enlaces solo aparecen si existe una URL HTTP(S) válida.
- La información adicional y el contacto existentes se conservan antes del RSVP.
- El enlace personal muestra el nombre del invitado antes del sobre y de la
  información de la boda. El mismo `RsvpForm` permite marcar con casillas los
  acompañantes que asistirán y responder directamente con **Asistir** o **No asistir**.
  Los acompañantes nombrados conservan su identidad aunque se elija solo el segundo
  o el último. Los cupos todavía sin nombre permiten indicar uno al seleccionarlos.
  El servidor calcula el total, valida la pertenencia y el cupo, y guarda el estado
  de cada acompañante en los RSVPs existentes. El total del grupo se guarda solo
  en el RSVP principal. Al volver a abrir el enlace se restaura la selección.
  Los novios pueden ver el estado individual al editar los acompañantes.
  El enlace general no ofrece un formulario de código: indica que debe abrirse
  el enlace personal. Los enlaces personales inválidos devuelven 404.
  La fecha límite y el modo de vista previa siguen aplicándose.

Los recursos gráficos son locales, con ilustraciones históricas de dominio público
adaptadas a salvia/marfil y ornamentos SVG. Las fuentes y adaptaciones se documentan
en `public/templates/floral-romance/ARTWORK.md`. Las fotografías de las referencias
no se usan como contenido de bodas reales.

Para incorporar otro diseño:

1. Añade sus metadatos a `src/lib/weddingTemplates.ts`.
2. Añade su componente y regístralo en `components/invitations/InvitationView.astro`.
3. Incluye su miniatura en `public/templates` y sus estilos bajo el selector
   `.invitation-shell[data-template="identificador"]`.

Los diseños reutilizan los componentes compartidos `InvitationActions` y `RsvpForm`;
Clásico utiliza `InvitationDetails` y Floral Romance presenta esos datos en sus
composiciones editoriales. El
envío y las validaciones siguen en los servicios existentes.

### Verificación

```sh
node --test tests/wedding-management.test.mjs
npm run build
```

La prueba de integración contra Supabase es opcional y usa dos bodas y una cuenta
temporales que elimina al terminar. Requiere el servidor local en marcha:

```sh
RSVP_INTEGRATION=1 node tests/wedding-smoke.mjs
```

También admite comprobaciones reales de navegador sin añadir paquetes al proyecto:
configura `RSVP_PLAYWRIGHT_MODULE` con la ruta de un módulo Playwright disponible y
`RSVP_BROWSER_EXECUTABLE` con su navegador. Opcionalmente, `RSVP_SCREENSHOTS` indica
un directorio existente para las capturas. Comprueba tamaños de 320, 390, 768 y
1440 px, búsqueda, filtros, edición, pestañas y RSVP.

La comprobación específica de Floral Romance no escribe en Supabase. Con el
servidor de desarrollo en marcha:

```sh
RSVP_TEST_ORIGIN=http://localhost:4321 \
RSVP_PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs \
RSVP_BROWSER_EXECUTABLE=/ruta/al/navegador \
RSVP_SCREENSHOTS=/directorio/existente \
node tests/floral-romance.browser.mjs
```

Opcionalmente, `RSVP_AXE_MODULE=/ruta/a/@axe-core/playwright/dist/index.mjs`
añade comprobaciones automáticas WCAG 2.1 AA. Se monta una página de prueba
temporal exclusiva de desarrollo y se elimina en `finally`; los datos ficticios
permanecen en `tests/fixtures`, fuera de las rutas de producción. Se capturan el
sobre, la apertura, cada sección y el formulario en móvil y escritorio. Se
comprueban calendario bisiesto, colores por boda, acompañantes, enlace personal,
aislamiento de vista previa y envío interceptado, sin guardar respuestas reales.

Con las mismas variables puede ejecutarse `node tests/seda-promesas.browser.mjs`.
Comprueba la nueva invitación a 320/390/768/1440 px, cada composición, nombres largos,
programa de 12 actividades, paleta completa, calendario bisiesto, contador real,
ausencia de datos y formulario personal. Las capturas llevan el prefijo `seda-`.

### Panel administrativo y gestión visual de invitados

El panel utiliza navegación lateral compacta, fondo cálido, tarjetas pastel,
tipografía DM Sans y un resumen lateral con datos del espacio de trabajo. El portal
de los novios comparte esa presentación con los datos de su propia boda. Los
estilos administrativos están separados de los estilos de las invitaciones.

**Invitados** abre la boda actual; desde el resumen usa `/weddings?section=guests`.
Con una sola boda entra directamente y con varias muestra un selector.
**Templates**, desde el resumen o el listado general, abre directamente el catálogo
de diseños en `/weddings?section=templates`, haya cero, una o varias bodas. Las
tarjetas muestran Clásico, Floral Romance y Seda & Promesas con imágenes y paletas.
**Ampliar diseño** abre su imagen y **Usar template** permite elegir la boda en un
modal. Desde ese modal también se puede abrir la vista previa con los datos reales
de la boda; al aplicar se utiliza el endpoint autorizado existente de esa boda.
Dentro de una boda se conserva su biblioteca contextual. El menú marca la sección
que se está gestionando.

`node tests/admin-ux.browser.mjs` utiliza las mismas variables externas de Playwright,
navegador, capturas y axe descritas arriba. Comprueba dashboard e invitados a
320/390/768/1440 px; modal y teclado; validación de contactos; formato telefónico;
aviso por acompañantes vacíos; creación con cupos y acompañantes nombrados;
compartir nativo y alternativas; selección con filtros y acciones por lote.
Utiliza una base de datos en memoria y el servicio real de invitados en una ruta
temporal exclusiva de desarrollo, eliminada al terminar. Las capturas llevan el
prefijo `admin-`.

## Recuperación de contraseña (Supabase)

En **Authentication → URL Configuration** del panel de Supabase, configura:

- **Site URL** (desarrollo): `http://localhost:4321`
- **Redirect URLs**: `http://localhost:4321/dashboard/reset-password`

Para producción, añade también la URL de recuperación con el dominio de despliegue
y usa ese dominio como Site URL.

Arranca la aplicación con `npm run dev`, abre `/dashboard/login` y pulsa
**Olvidé mi contraseña**. Solicita un correo nuevo y abre el enlace en el mismo
navegador donde lo pediste (el flujo de la aplicación usa PKCE). La página de
recuperación permite guardar una contraseña nueva y entrar al dashboard.

Si envías la recuperación desde el panel de Supabase, indica
`http://localhost:4321/dashboard/reset-password` como destino de redirección.
La página también admite los tokens de recuperación enviados por ese flujo.

## Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
