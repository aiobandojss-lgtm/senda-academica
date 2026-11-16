import type { ConfigPublica } from "@/lib/api";

// BORRADOR del aviso de privacidad (design.md D16). Lo aporta y aprueba la Fundación, responsable del
// tratamiento; este texto solo cubre el contenido mínimo de la Ley 1581 de 2012 y del Decreto 1074 de 2015
// (responsable y contacto, tratamiento y finalidades, derechos del titular y cómo ejercerlos).
// Si cambias el texto de fondo, sube AVISO_PRIVACIDAD_VERSION en wrangler.jsonc (y en el seed): así cada
// persona vuelve a aceptarlo. Los nombres y el contacto llegan de la configuración, nunca escritos aquí.
export function TextoAvisoPrivacidad({ config }: { config: ConfigPublica }) {
  const { fundacionNombre, productoNombre, contactoFundacion } = config;

  return (
    <div className="space-y-5 text-[0.95rem] leading-relaxed [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
      <p>
        <strong>{fundacionNombre}</strong> es responsable del tratamiento de los datos personales que se registran en{" "}
        {productoNombre}, su plataforma académica.
      </p>

      <section className="space-y-2">
        <h2>Qué datos tratamos</h2>
        <ul>
          <li>De identificación: nombres, apellidos y número de documento.</li>
          <li>De contacto: correo y celular, si los registraste.</li>
          <li>Académicos: carrera, semestre, cursos, entregas y calificaciones.</li>
          <li>Financieros: cuotas, pagos y acuerdos de pago.</li>
          <li>Las preguntas que le hagas al asistente académico, que se guardan durante 30 días.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Darte acceso a la plataforma y proteger tu cuenta.</li>
          <li>Gestionar tus cursos, entregas y calificaciones.</li>
          <li>Administrar tus cuotas y pagos, y el acceso a la plataforma según tu estado de cuenta.</li>
          <li>Responder tus preguntas con el asistente académico.</li>
          <li>Comunicarnos contigo sobre tu proceso académico y financiero.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>Quién los ve</h2>
        <ul>
          <li>El personal administrativo autorizado de la Fundación.</li>
          <li>Tus docentes ven tu nombre, tus entregas y tus notas, pero no tus datos de contacto.</li>
          <li>El asistente académico, que usa inteligencia artificial, nunca recibe tu documento, tu correo ni tu celular.</li>
          <li>
            La plataforma funciona en servicios de nube que pueden guardar la información fuera de Colombia, con medidas de
            seguridad.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>Tus derechos</h2>
        <p>Como titular de los datos puedes:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que diste y saber cómo se han usado tus datos.</li>
          <li>Revocar la autorización o pedir que se borren tus datos, cuando la ley lo permita.</li>
          <li>Consultar tus datos gratis.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
        </ul>
        <p>Para ejercerlos, comunícate con {contactoFundacion}.</p>
      </section>
    </div>
  );
}
