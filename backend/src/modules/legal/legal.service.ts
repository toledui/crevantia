import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateLegalDocumentDto } from './legal.dto';

const DEFAULT_TERMS_CONTENT = `
# Términos y Condiciones de Uso de Crevantia

**Última actualización:** 18 de agosto de 2026  
**Versión oficial:** 1.0

Bienvenido a **Crevantia**, la plataforma integral de evaluación, diagnóstico psicométrico y análisis de potencial ejecutivo. Al acceder a nuestro sitio web, registrarte como usuario o adquirir una evaluación psicométrica, aceptas cumplir con los presentes Términos y Condiciones de Uso.

---

## 1. Objeto y Alcance del Servicio
Crevantia provee herramientas digitales especializadas para la aplicación estandarizada de reactivos psicométricos, cálculo computacional de baremos en deciles y emisión automatizada de reportes ejecutivos de competencias, liderazgo y perfil conductual.

## 2. Cuentas de Usuario y Confidencialidad
- **Registro:** Para responder o administrar evaluaciones es necesario contar con una cuenta activa y verificada.
- **Responsabilidad:** El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de toda la actividad efectuada desde su cuenta.
- **Veracidad:** La información suministrada (nombre, correo electrónico, datos demográficos) debe ser fidedigna, pues se utilizará para la emisión de los informes oficiales y comprobantes fiscales.

## 3. Propiedad Intelectual y Confidencialidad de los Reactivos
- **Derechos Reservados:** Los cuestionarios, reactivos psicométricos (incluyendo la prueba DPO-PRO y sus algoritmos), matrices de baremación, manuales técnicos y reportes generados son propiedad intelectual exclusiva de Crevantia.
- **Prohibición de Copia y Difusión:** Queda estrictamente prohibida la reproducción total o parcial, captura de pantalla no autorizada, descompilación, extracción sistemática o divulgación de las preguntas o claves de calificación psicométrica.

## 4. Condiciones de Compra, Pagos y Asignaciones
- **Licencias Individuales:** Cada compra o asignación otorga el derecho a responder una (1) aplicación psicométrica individual y descargar su reporte ejecutivo correspondiente.
- **Pasarela de Pagos:** Las transacciones con tarjeta de crédito/débito son procesadas de manera segura y cifrada a través de Stripe. Crevantia no almacena información de tarjetas bancarias.
- **Cupones de Descuento:** Los códigos de cupón son de uso personal, sujetos a vigencia y límites de canje establecidos en cada campaña.

## 5. Integridad y Ética en la Aplicación
El candidato o evaluado se compromete a responder las pruebas de forma honesta, individual y sin el uso de automatizaciones, asistentes externos o suplantación de identidad. Crevantia se reserva el derecho de anular intentos que muestren patrones de respuesta anómalos o vulneración de seguridad.

## 6. Disponibilidad de la Plataforma y Soporte
Nos esforzamos por garantizar una disponibilidad del servicio del 99.9%. En caso de interrupciones técnicas o fallas en la conexión durante una prueba en progreso, el sistema guarda automáticamente las respuestas para permitir la reanudación desde el panel del usuario o mediante asistencia técnica del Superadministrador.

## 7. Modificaciones a los Términos
Crevantia se reserva el derecho de actualizar estos términos en cualquier momento. Las modificaciones entrarán en vigor a partir de su publicación en esta plataforma.

## 8. Legislación y Jurisdicción
Estos Términos se rigen por las leyes aplicables de los Estados Unidos Mexicanos. Cualquier controversia será sometida a la jurisdicción de los tribunales competentes de la Ciudad de México.
`.trim();

const DEFAULT_PRIVACY_CONTENT = `
# Política de Privacidad y Tratamiento de Datos Personales

**Última actualización:** 18 de agosto de 2026  
**Versión oficial:** 1.0

En **Crevantia**, la privacidad, seguridad y confidencialidad de la información de nuestros candidatos, clientes y evaluadores es nuestra máxima prioridad. La presente Política de Privacidad describe cómo recopilamos, utilizamos, protegemos y compartimos tus datos personales.

---

## 1. Responsable del Tratamiento
**Crevantia Plataforma Psicométrica S.A. de C.V.** (en adelante "Crevantia"), con domicilio fiscal en Ciudad de México, México, es el responsable del tratamiento legítimo y confidencial de tus datos personales.

## 2. Datos Personales que Recopilamos
Para brindar nuestros servicios de diagnóstico psicométrico y gestión de cuentas, podemos recopilar:
- **Datos de Identificación y Contacto:** Nombre completo, correo electrónico, teléfono y contraseña cifrada con estándares Argon2.
- **Datos Demográficos Opcionales:** Rango de edad, país, nivel de escolaridad o área profesional (utilizados exclusivamente para baremación estadística agregada y no vinculante).
- **Datos Psicométricos y Respuestas:** Selecciones y respuestas a reactivos psicométricos, tiempos de respuesta por reactivo y puntuaciones calculadas.
- **Datos de Transacción y Facturación:** Folio de compra, producto adquirido, historial de pagos y datos fiscales para emisión de comprobantes.

## 3. Finalidades del Tratamiento
Tus datos son recabados para los siguientes fines primarios y esenciales:
1. Crear y autenticar tu cuenta en el entorno seguro de Crevantia.
2. Administrar la aplicación de pruebas psicométricas y guardar tu progreso en vivo.
3. Procesar las respuestas mediante matrices normativas estandarizadas y generar reportes oficiales en formato PDF.
4. Enviar notificaciones de servicio, invitaciones a evaluaciones, enlaces de restablecimiento de credenciales y comprobantes de compra.
5. Brindar soporte técnico y auditoría de seguridad operativa.

## 4. Medidas de Seguridad y Cifrado
Implementamos rigurosos controles técnicos, físicos y administrativos para resguardar tu información:
- **Cifrado en Tránsito y Reposo:** Todas las comunicaciones están protegidas bajo TLS 1.3 / HTTPS. Las contraseñas se almacenan mediante hashes unidireccionales Argon2.
- **Aislamiento de Datos Psicométricos:** Las respuestas e interpretaciones solo son accesibles por el evaluado y los administradores autorizados.
- **No Comercialización:** Crevantia **NUNCA** vende, renta ni comercializa bases de datos personales o psicométricas a terceros con fines publicitarios.

## 5. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)
Tienes derecho a acceder a tus datos personales, rectificarlos en caso de inexactitud, solicitar su cancelación cuando ya no sean necesarios para los fines estipulados, u oponerte a tratamientos específicos.
- Para ejercer tus derechos ARCO, puedes gestionar tus datos desde **Mi Perfil** en la plataforma o enviar una solicitud formal a nuestro oficial de privacidad: **privacidad@crevantia.com**.

## 6. Uso de Cookies y Tecnologías Similares
Utilizamos cookies estrictamente necesarias para la gestión de sesiones seguras (refreshToken en cookies seguras HttpOnly) y preferencias del usuario. No utilizamos cookies de rastreo de terceros para publicidad comportamental.

## 7. Cambios a la Política de Privacidad
Cualquier actualización sustancial a esta Política será publicada en esta misma página y notificada en el panel de control de los usuarios registrados.
`.trim();

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDocument(type: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY') {
    const doc = await this.prisma.legalDocument.findUnique({ where: { type } });
    if (!doc) {
      const defaultTitle =
        type === 'TERMS_AND_CONDITIONS'
          ? 'Términos y Condiciones de Uso'
          : 'Política de Privacidad y Tratamiento de Datos Personales';
      const defaultContent =
        type === 'TERMS_AND_CONDITIONS' ? DEFAULT_TERMS_CONTENT : DEFAULT_PRIVACY_CONTENT;

      return {
        id: type.toLowerCase(),
        type,
        title: defaultTitle,
        content: defaultContent,
        version: '1.0',
        updatedBy: 'Sistema Crevantia',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return doc;
  }

  async getAllDocuments() {
    const [terms, privacy] = await Promise.all([
      this.getDocument('TERMS_AND_CONDITIONS'),
      this.getDocument('PRIVACY_POLICY'),
    ]);
    return { terms, privacy };
  }

  async updateDocument(actorId: string, dto: UpdateLegalDocumentDto) {
    const existing = await this.prisma.legalDocument.findUnique({ where: { type: dto.type } });

    const updated = await this.prisma.legalDocument.upsert({
      where: { type: dto.type },
      update: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        version: dto.version?.trim() || existing?.version || '1.0',
        updatedBy: actorId,
      },
      create: {
        type: dto.type,
        title: dto.title.trim(),
        content: dto.content.trim(),
        version: dto.version?.trim() || '1.0',
        updatedBy: actorId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'LEGAL_DOCUMENT_UPDATED',
        entityType: 'LegalDocument',
        entityId: updated.id,
        metadata: {
          type: updated.type,
          title: updated.title,
          version: updated.version,
        },
      },
    });

    return updated;
  }
}
