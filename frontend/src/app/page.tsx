import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeNavbar } from '@/components/home-navbar';
import { HomePricingSlider } from '@/components/home-pricing-slider';
import { HomeContactForm } from '@/components/home-contact-form';
import styles from './home.module.css';
import { getPublicSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublicSiteSettings();
  return { title: 'Evaluación DPO-PRO', description: `Conoce tus patrones de decisión, capacidades y fortalezas con la evaluación psicométrica DPO-PRO de ${site.siteName}.` };
}

const benefits = [
  ['01', 'Perfil psicométrico estructurado', 'Tus respuestas se procesan mediante una clave de puntuación y una norma para ubicar tus resultados en una escala comparativa.'],
  ['02', 'Resultados visuales y comprensibles', 'El reporte presenta escalas, capacidades y áreas relevantes mediante gráficas y explicaciones que facilitan su lectura.'],
  ['03', 'Acceso seguro desde cualquier dispositivo', 'Contesta desde computadora, tableta o móvil. Tu avance se conserva mientras la evaluación permanezca activa.'],
];

const steps = [
  ['Crea tu cuenta', 'Regístrate con tu correo para acceder a tu panel personal y conservar tus evaluaciones y reportes.'],
  ['Adquiere la evaluación', 'Realiza el pago de forma segura. Una vez confirmado, la evaluación quedará disponible en tu cuenta.'],
  ['Contesta a tu ritmo', 'Responde las secciones de la prueba. El sistema guarda automáticamente tu progreso para que puedas continuar después.'],
  ['Consulta tu reporte', 'Al finalizar, el sistema procesa tus resultados y habilita el reporte correspondiente para consulta y descarga.'],
];

const results = [
  ['Visión estratégica', '78%', '8'],
  ['Autodominio', '64%', '6'],
  ['Adaptabilidad', '88%', '9'],
  ['Resiliencia', '72%', '7'],
  ['Planeación', '83%', '8'],
];

const faqs = [
  ['¿Tengo que terminar la evaluación en una sola sesión?', 'La recomendación es realizarla en condiciones de concentración, pero la plataforma guarda tu avance y te permite continuar posteriormente mientras la evaluación siga activa.'],
  ['¿Cuándo podré consultar mis resultados?', 'Una vez que finalices la evaluación y el sistema procese correctamente tus respuestas, el reporte quedará disponible desde tu panel personal.'],
  ['¿Puedo descargar mi reporte?', 'Sí. El reporte generado quedará asociado a tu evaluación y podrás descargarlo desde tu cuenta.'],
  ['¿El precio puede cambiar?', 'Sí. El importe mostrado corresponde al precio vigente configurado en la plataforma al momento de la compra.'],
];

function Logo({ name, src, light = false }: { name: string; src: string; light?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`${styles.logo}${light ? ` ${styles.logoLight}` : ''}`} src={src} alt={name} />;
}

export default async function Home() {
  const site = await getPublicSiteSettings();
  const hasContact = Boolean(site.contactEmail || site.contactPhone || site.contactWhatsapp || site.contactAddress || site.contactHours);
  return (
    <div className={styles.page}>
      <HomeNavbar />

      <main id="inicio">
        <section className={styles.hero}>
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroContent}>
              <span className={styles.eyebrow}>Conócete con mayor profundidad</span>
              <h1>Entiende los patrones que están detrás de <span>cómo decides y actúas.</span></h1>
              <p className={styles.heroCopy}>{site.siteName} te permite realizar una evaluación psicométrica estructurada para identificar rasgos, tendencias y capacidades que influyen en la forma en que enfrentas decisiones, objetivos y situaciones relevantes de tu vida.</p>
              <div className={styles.heroActions}>
                <Link href="/registro" className={`${styles.button} ${styles.buttonCyan}`}>Comenzar evaluación <span aria-hidden="true">→</span></Link>
                <a href="#evaluacion" className={`${styles.button} ${styles.buttonOutline}`}>Conocer cómo funciona</a>
              </div>
              <div className={styles.trustLine}><span><i />Evaluación en línea</span><span><i />Avance guardado automáticamente</span><span><i />Reporte personal descargable</span></div>
            </div>

            <div className={styles.heroVisual} aria-label="Ejemplo ilustrativo de un reporte de resultados">
              <div className={styles.visualShell}>
                <div className={styles.visualTop}><div><small>Ejemplo de resultados</small><strong>Perfil de capacidades</strong></div><div className={styles.scoreBadge}>7.8</div></div>
                <div className={styles.visualCard}>
                  <h2>Resumen de fortalezas</h2><p>Representación visual demostrativa de una evaluación finalizada.</p>
                  <div className={styles.miniBars}>{results.map(([label, width, score]) => <div className={styles.miniRow} key={label}><span>{label}</span><div className={styles.miniTrack}><i style={{ width }} /></div><b>{score}</b></div>)}</div>
                </div>
                <div className={styles.resultStrip}><div><small>Escalas</small><strong>48</strong></div><div><small>Resultado</small><strong>1–10</strong></div><div><small>Reporte</small><strong>PDF</strong></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.soft}`} id="evaluacion">
          <div className={styles.container}>
            <div className={`${styles.sectionHead} ${styles.center}`}><span className={styles.eyebrow}>Una experiencia estructurada</span><h2>Más que responder preguntas: una lectura organizada de tu perfil.</h2><p>La evaluación combina distintos tipos de reactivos para obtener información comparativa y transformarla en resultados fáciles de interpretar.</p></div>
            <div className={styles.benefitsGrid}>{benefits.map(([number, title, copy]) => <article className={styles.benefit} key={number}><div className={styles.benefitIcon}>{number}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>
          </div>
        </section>

        <section className={styles.section} id="como-funciona">
          <div className={styles.container}>
            <div className={styles.sectionHead}><span className={styles.eyebrow}>Cómo funciona</span><h2>Un proceso simple para el usuario.</h2><p>Desde el registro hasta la descarga del reporte, el flujo está pensado para que la experiencia sea clara y sin pasos innecesarios.</p></div>
            <div className={styles.process}>{steps.map(([title, copy], index) => <article className={styles.step} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
          </div>
        </section>

        <section className={`${styles.priceSection} ${styles.soft}`} id="precio">
          <div className={`${styles.container} ${styles.priceLayout}`}>
            <div className={styles.priceCopy}>
              <span className={styles.eyebrow}>Acceso individual</span><h2>Todo lo necesario para realizar tu evaluación y recibir tus resultados.</h2><p>Con un solo acceso obtienes la experiencia completa de evaluación, el procesamiento de tus respuestas y tu reporte personal.</p>
              <div className={styles.included}>{['Una evaluación DPO-PRO', 'Acceso desde tu panel personal', 'Guardado automático del avance', 'Procesamiento de resultados', 'Reporte descargable en PDF', 'Historial disponible en tu cuenta'].map((item) => <span key={item}><i>✓</i>{item}</span>)}</div>
            </div>
            <HomePricingSlider />
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.container} ${styles.security}`}>
            <div className={styles.securityPanel}><span className={styles.eyebrow}>Privacidad y continuidad</span><h2>Tu evaluación está diseñada para que puedas concentrarte en responder.</h2><p>Las respuestas se guardan progresivamente y quedan asociadas a tu cuenta. Una vez que envías la evaluación de forma definitiva, tus respuestas quedan protegidas contra modificaciones.</p></div>
            <div className={styles.facts}><div><strong>30–40 min</strong><span>Tiempo estimado de aplicación</span></div><div><strong>4</strong><span>Secciones dentro de la experiencia</span></div><div><strong>Auto</strong><span>Guardado de respuestas</span></div><div><strong>PDF</strong><span>Reporte disponible al finalizar</span></div></div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.soft}`} id="faq">
          <div className={styles.container}>
            <div className={`${styles.sectionHead} ${styles.center}`}><span className={styles.eyebrow}>Preguntas frecuentes</span><h2>Antes de comenzar.</h2></div>
            <div className={styles.faq}>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>{question}</span><i aria-hidden="true">＋</i></summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className={styles.section} id="contacto">
          <div className={styles.container}>
            <div className={styles.contactLayout}>
              <div className={styles.contactContent}>
                <div className={styles.sectionHead}><span className={styles.eyebrow}>Estamos para ayudarte</span><h2>Contacto</h2><p>{hasContact ? `Comunícate con el equipo de ${site.siteName} por el medio que te resulte más cómodo.` : 'La información de contacto estará disponible próximamente.'}</p></div>
                {hasContact && <div className={styles.contactGrid}>
                  {site.contactEmail && <a className={styles.contactCard} href={`mailto:${site.contactEmail}`}><small>Correo electrónico</small><strong>{site.contactEmail}</strong><span>Enviar mensaje →</span></a>}
                  {site.contactPhone && <a className={styles.contactCard} href={`tel:${site.contactPhone.replace(/[^+\d]/g, '')}`}><small>Teléfono</small><strong>{site.contactPhone}</strong><span>Llamar ahora →</span></a>}
                  {site.contactWhatsapp && <a className={styles.contactCard} href={`https://wa.me/${site.contactWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><small>WhatsApp</small><strong>{site.contactWhatsapp}</strong><span>Abrir conversación →</span></a>}
                  {(site.contactAddress || site.contactHours) && <div className={styles.contactCard}><small>Ubicación y horario</small>{site.contactAddress && <strong>{site.contactAddress}</strong>}{site.contactHours && <p>{site.contactHours}</p>}{site.contactMapUrl && <a href={site.contactMapUrl} target="_blank" rel="noreferrer">Ver mapa →</a>}</div>}
                </div>}
              </div>
              <HomeContactForm captcha={site.contactCaptcha} />
            </div>
          </div>
        </section>

        <section className={styles.cta}><div className={styles.container}><div className={styles.ctaBox}><div><h2>Tu evaluación comienza cuando estés listo.</h2><p>Crea tu cuenta, adquiere tu acceso y realiza la evaluación desde un entorno diseñado para leer y responder con tranquilidad.</p></div><Link href="/pago/dpo-pro" className={`${styles.button} ${styles.buttonCyan}`}>Ver precio y comenzar <span aria-hidden="true">→</span></Link></div></div></section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <Logo name={site.siteName} src={site.logoUrl} light />
          <span>© 2026 {site.siteName} · Todos los derechos reservados.</span>
          <span>
            <Link href="/politica-de-privacidad" style={{ color: 'inherit', textDecoration: 'none' }}>
              Aviso de privacidad
            </Link>{' '}
            ·{' '}
            <Link href="/terminos-y-condiciones" style={{ color: 'inherit', textDecoration: 'none' }}>
              Términos de uso
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
