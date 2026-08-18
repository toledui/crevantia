import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto, SetProductPriceDto, UpdateProductDto } from './commerce.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts(publicOnly = true) {
    const products = await this.prisma.evaluationProduct.findMany({
      where: publicOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        test: {
          select: {
            id: true,
            code: true,
            name: true,
            slug: true,
            versions: {
              where: { status: 'PUBLISHED' },
              orderBy: { version: 'desc' },
              take: 1,
              select: { version: true, language: true, estimatedMin: true },
            },
          },
        },
        priceVersions: {
          where: { isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    const now = new Date();
    return products.map((product) => {
      // Find current active price
      const currentPrice = product.priceVersions.find(
        (pv) => pv.effectiveFrom <= now && (!pv.effectiveTo || pv.effectiveTo > now),
      ) ?? product.priceVersions[0];

      const publishedVersion = product.test.versions[0];

      return {
        id: product.id,
        code: product.code,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        features: (product.features as string[]) || [],
        isActive: product.isActive,
        sortOrder: product.sortOrder,
        testId: product.testId,
        testCode: product.test.code,
        testName: product.test.name,
        publishedVersion: publishedVersion ? publishedVersion.version : null,
        estimatedMin: publishedVersion?.estimatedMin ?? null,
        currentPrice: currentPrice
          ? {
              id: currentPrice.id,
              amountCents: currentPrice.amountCents,
              amountFormatted: (currentPrice.amountCents / 100).toFixed(2),
              currency: currentPrice.currency,
              effectiveFrom: currentPrice.effectiveFrom,
            }
          : null,
        createdAt: product.createdAt,
      };
    });
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.evaluationProduct.findUnique({
      where: { slug },
      include: {
        test: {
          select: {
            id: true,
            code: true,
            name: true,
            slug: true,
            versions: {
              where: { status: 'PUBLISHED' },
              orderBy: { version: 'desc' },
              take: 1,
              select: { id: true, version: true, language: true, estimatedMin: true },
            },
          },
        },
        priceVersions: {
          where: { isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('El producto de evaluación no existe o no está disponible.');
    }

    const now = new Date();
    const currentPrice = product.priceVersions.find(
      (pv) => pv.effectiveFrom <= now && (!pv.effectiveTo || pv.effectiveTo > now),
    ) ?? product.priceVersions[0];

    if (!currentPrice) {
      throw new BadRequestException('El producto no tiene un precio activo configurado.');
    }

    const publishedVersion = product.test.versions[0];

    return {
      id: product.id,
      code: product.code,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      features: (product.features as string[]) || [],
      testId: product.testId,
      testCode: product.test.code,
      testName: product.test.name,
      publishedVersionId: publishedVersion?.id ?? null,
      publishedVersion: publishedVersion?.version ?? null,
      estimatedMin: publishedVersion?.estimatedMin ?? null,
      currentPrice: {
        id: currentPrice.id,
        amountCents: currentPrice.amountCents,
        amountFormatted: (currentPrice.amountCents / 100).toFixed(2),
        currency: currentPrice.currency,
        effectiveFrom: currentPrice.effectiveFrom,
      },
    };
  }

  async createProduct(actorId: string, dto: CreateProductDto) {
    const existing = await this.prisma.evaluationProduct.findFirst({
      where: { OR: [{ code: dto.code.trim().toUpperCase() }, { slug: dto.slug.trim().toLowerCase() }] },
    });
    if (existing) {
      throw new ConflictException('Ya existe un producto con ese código o slug.');
    }

    const test = await this.prisma.test.findUnique({ where: { id: dto.testId } });
    if (!test) throw new NotFoundException('La prueba vinculada no existe.');

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.evaluationProduct.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          slug: dto.slug.trim().toLowerCase(),
          name: dto.name.trim(),
          shortDescription: dto.shortDescription?.trim(),
          description: dto.description?.trim(),
          features: dto.features ? dto.features : undefined,
          testId: dto.testId,
          assessmentId: dto.assessmentId,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 1,
        },
      });

      await tx.priceVersion.create({
        data: {
          productId: created.id,
          amountCents: dto.initialPriceCents,
          currency: dto.currency?.trim().toUpperCase() || 'MXN',
          effectiveFrom: new Date(),
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EVALUATION_PRODUCT_CREATED',
          entityType: 'EvaluationProduct',
          entityId: created.id,
          metadata: { code: created.code, initialPriceCents: dto.initialPriceCents },
        },
      });

      return created;
    });

    return this.getProductBySlug(product.slug);
  }

  async updateProduct(actorId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.evaluationProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('El producto no existe.');

    const updated = await this.prisma.evaluationProduct.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        shortDescription: dto.shortDescription !== undefined ? dto.shortDescription?.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() : undefined,
        features: dto.features !== undefined ? dto.features : undefined,
        testId: dto.testId,
        assessmentId: dto.assessmentId,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'EVALUATION_PRODUCT_UPDATED',
        entityType: 'EvaluationProduct',
        entityId: id,
        metadata: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return updated;
  }

  async setProductPrice(actorId: string, productId: string, dto: SetProductPriceDto) {
    const product = await this.prisma.evaluationProduct.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('El producto no existe.');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    const priceVersion = await this.prisma.$transaction(async (tx) => {
      // If setting an immediate price without future scheduling, close previous active price
      if (!dto.effectiveFrom || effectiveFrom <= new Date()) {
        await tx.priceVersion.updateMany({
          where: { productId, isActive: true, effectiveTo: null },
          data: { effectiveTo: effectiveFrom },
        });
      }

      const created = await tx.priceVersion.create({
        data: {
          productId,
          amountCents: dto.amountCents,
          currency: dto.currency?.trim().toUpperCase() || 'MXN',
          effectiveFrom,
          effectiveTo,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PRICE_VERSION_CREATED',
          entityType: 'PriceVersion',
          entityId: created.id,
          metadata: { productId, amountCents: dto.amountCents, currency: created.currency },
        },
      });

      return created;
    });

    return priceVersion;
  }

  async getPriceHistory(productId: string) {
    return this.prisma.priceVersion.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
