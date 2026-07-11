require('reflect-metadata');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const { ArgumentMetadata, ValidationPipe } = require('@nestjs/common');
const { defaultMetadataStorage } = require('class-transformer/cjs/storage');
const { getMetadataStorage } = require('class-validator');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const { createValidationException } = require(
  path.join(DIST_DIR, 'common/errors/validation-error.util.js'),
);
const UUID = '11111111-1111-4111-8111-111111111111';
const VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: createValidationException,
});

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function loadDtoContracts() {
  const dtoFiles = walkFiles(DIST_DIR)
    .filter((file) => file.endsWith('.dto.js'))
    .sort((a, b) => a.localeCompare(b));

  return dtoFiles.flatMap((file) => {
    const exports = require(file);
    const contracts = Object.entries(exports)
      .filter(([, value]) => typeof value === 'function')
      .map(([exportName, dtoClass]) => {
        const metadata = getValidationMetadata(dtoClass);
        return {
          dtoClass,
          exportName,
          file,
          metadata,
          properties: groupByProperty(metadata),
        };
      })
      .filter((contract) => contract.metadata.length > 0);

    assert.ok(
      contracts.length > 0,
      `${relative(file)} must export at least one class-validator-backed DTO class`,
    );

    return contracts;
  });
}

function getValidationMetadata(dtoClass) {
  return getMetadataStorage().getTargetValidationMetadatas(dtoClass, '', false, false);
}

function groupByProperty(metadata) {
  const grouped = new Map();
  for (const item of metadata) {
    if (!grouped.has(item.propertyName)) {
      grouped.set(item.propertyName, []);
    }
    grouped.get(item.propertyName).push(item);
  }
  return grouped;
}

function isOptional(metadata) {
  return metadata.some(
    (item) => item.type === 'conditionalValidation' && item.name === 'isOptional',
  );
}

function isNested(metadata) {
  return metadata.some((item) => item.type === 'nestedValidation');
}

function hasValidator(metadata, name) {
  return metadata.some((item) => item.name === name);
}

function firstConstraint(metadata, name) {
  return metadata.find((item) => item.name === name)?.constraints?.[0];
}

function metadataForProperty(contract, property) {
  return contract.properties.get(property) ?? [];
}

function hasDefaultValue(contract, property) {
  try {
    return new contract.dtoClass()[property] !== undefined;
  } catch {
    return false;
  }
}

function buildValidPayload(contract, seen = new Set()) {
  if (seen.has(contract.dtoClass)) {
    return {};
  }

  seen.add(contract.dtoClass);
  const payload = {};

  for (const [property, metadata] of contract.properties.entries()) {
    if (isOptional(metadata)) {
      continue;
    }
    payload[property] = validValueForProperty(contract, property, metadata, seen);
  }

  seen.delete(contract.dtoClass);
  return payload;
}

function validValueForProperty(contract, property, metadata, seen) {
  if (isNested(metadata)) {
    const nestedClass = nestedType(contract.dtoClass, property);
    const nestedContract = contractForClass(nestedClass);
    const nestedValue = nestedContract ? buildValidPayload(nestedContract, seen) : {};
    return hasValidator(metadata, 'isArray') || metadata.some((item) => item.each)
      ? [nestedValue]
      : nestedValue;
  }

  if (hasValidator(metadata, 'isArray')) {
    const arrayItem = arrayItemValue(metadata);
    return hasValidator(metadata, 'arrayMinSize') || hasValidator(metadata, 'arrayNotEmpty')
      ? [arrayItem]
      : [arrayItem];
  }

  if (hasValidator(metadata, 'isBoolean')) {
    return true;
  }

  if (hasValidator(metadata, 'isNumber') || hasValidator(metadata, 'isInt')) {
    return validNumber(metadata);
  }

  if (hasValidator(metadata, 'isLatitude')) {
    return 24.7136;
  }

  if (hasValidator(metadata, 'isLongitude')) {
    return 46.6753;
  }

  if (hasValidator(metadata, 'isUuid')) {
    return UUID;
  }

  if (hasValidator(metadata, 'isEmail')) {
    return 'valid@example.com';
  }

  if (hasValidator(metadata, 'isUrl')) {
    return 'https://example.com/file.png';
  }

  if (hasValidator(metadata, 'isDateString') || hasValidator(metadata, 'isIso8601')) {
    return '2026-05-08T00:00:00.000Z';
  }

  if (hasValidator(metadata, 'isEnum') || hasValidator(metadata, 'isIn')) {
    return firstAllowedValue(metadata);
  }

  if (hasValidator(metadata, 'isObject')) {
    return {};
  }

  if (hasValidator(metadata, 'matches')) {
    return sampleForRegex(firstConstraint(metadata, 'matches'));
  }

  if (hasValidator(metadata, 'isString') || hasValidator(metadata, 'isNotEmpty')) {
    return validString(metadata);
  }

  return valueFromDesignType(contract.dtoClass, property);
}

function arrayItemValue(metadata) {
  if (hasValidator(metadata, 'isUuid')) {
    return UUID;
  }
  if (hasValidator(metadata, 'isString')) {
    return validString(metadata);
  }
  if (hasValidator(metadata, 'isNumber') || hasValidator(metadata, 'isInt')) {
    return validNumber(metadata);
  }
  if (hasValidator(metadata, 'isBoolean')) {
    return true;
  }
  if (hasValidator(metadata, 'isEnum') || hasValidator(metadata, 'isIn')) {
    return firstAllowedValue(metadata);
  }
  return {};
}

function validNumber(metadata) {
  const min = firstConstraint(metadata, 'min');
  const max = firstConstraint(metadata, 'max');
  let value = typeof min === 'number' ? min : 1;
  if (typeof max === 'number' && value > max) {
    value = max;
  }
  if (hasValidator(metadata, 'isInt')) {
    value = Math.trunc(value);
  }
  return value;
}

function validString(metadata) {
  if (hasValidator(metadata, 'isUppercase')) {
    return 'SA';
  }

  const lengthConstraints = metadata.find((item) => item.name === 'isLength')?.constraints;
  const minLength = firstConstraint(metadata, 'minLength') ?? lengthConstraints?.[0] ?? 1;
  const maxLength = firstConstraint(metadata, 'maxLength') ?? lengthConstraints?.[1];
  const size = Math.max(1, minLength);
  const boundedSize = typeof maxLength === 'number' ? Math.min(size, maxLength) : size;
  return 'a'.repeat(boundedSize);
}

function firstAllowedValue(metadata) {
  const enumValues = firstConstraint(metadata, 'isEnum');
  if (enumValues && typeof enumValues === 'object') {
    return Object.values(enumValues).find(
      (value) => typeof value === 'string' || typeof value === 'number',
    );
  }

  const inValues = firstConstraint(metadata, 'isIn');
  if (Array.isArray(inValues)) {
    return inValues[0];
  }

  return 'valid';
}

function sampleForRegex(regex) {
  const source = regex?.source ?? '';
  if (source === '^#[A-Fa-f0-9]{6}$') return '#A1B2C3';
  if (source === '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$') {
    return 'store.example.com';
  }
  if (source === '^(monthly|annual)$') return 'monthly';
  if (source === '^[A-Z]{3}$') return 'SAR';
  if (source === '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$') return 'valid-slug';
  if (source === '^[a-z0-9]+(?:-[a-z0-9]+)*$') return 'valid-slug';
  if (source === '^[a-z0-9]+(?:_[a-z0-9]+)*$') return 'valid_key';
  if (source === '^[a-zA-Z0-9_-]+$') return 'valid_key';
  if (source === '^\\+?[0-9]{7,15}$') return '+966500000000';
  if (source === '^\\d{6}$') return '123456';
  if (source === '^sf_[a-z0-9_]+$') return 'sf_valid_key';
  return 'valid';
}

function valueFromDesignType(dtoClass, property) {
  const designType = Reflect.getMetadata('design:type', dtoClass.prototype, property);
  if (designType === Number) return 1;
  if (designType === Boolean) return true;
  if (designType === Array) return [];
  if (designType === Object) return {};
  return 'valid';
}

function nestedType(dtoClass, property) {
  const typeMetadata = defaultMetadataStorage.findTypeMetadata(dtoClass, property);
  if (typeMetadata?.typeFunction) {
    return typeMetadata.typeFunction();
  }
  if (typeMetadata?.reflectedType && typeMetadata.reflectedType !== Array) {
    return typeMetadata.reflectedType;
  }
  return Reflect.getMetadata('design:type', dtoClass.prototype, property);
}

function invalidPayloadFor(contract) {
  const payload = buildValidPayload(contract);
  const candidate = [...contract.properties.entries()].find(([, metadata]) =>
    metadata.some((item) => item.name !== 'isOptional'),
  );

  assert.ok(candidate, `${contract.exportName} must expose at least one constrained property`);

  const [property, metadata] = candidate;
  payload[property] = invalidValueForProperty(contract, property, metadata);
  return { payload, property };
}

function invalidValueForProperty(contract, property, metadata) {
  if (hasValidator(metadata, 'isArray')) {
    return 'not-an-array';
  }
  if (hasValidator(metadata, 'isBoolean')) {
    return 'not-a-boolean';
  }
  if (hasValidator(metadata, 'isNumber') || hasValidator(metadata, 'isInt')) {
    return 'not-a-number';
  }
  if (hasValidator(metadata, 'isLatitude') || hasValidator(metadata, 'isLongitude')) {
    return 'not-a-coordinate';
  }
  if (hasValidator(metadata, 'isUuid')) {
    return 'not-a-uuid';
  }
  if (hasValidator(metadata, 'isEmail')) {
    return 'not-an-email';
  }
  if (hasValidator(metadata, 'isUrl')) {
    return 'not-a-url';
  }
  if (hasValidator(metadata, 'isDateString') || hasValidator(metadata, 'isIso8601')) {
    return 'not-a-date';
  }
  if (hasValidator(metadata, 'isEnum') || hasValidator(metadata, 'isIn')) {
    return '__invalid_enum_value__';
  }
  if (hasValidator(metadata, 'matches')) {
    return 'invalid pattern!';
  }
  if (hasValidator(metadata, 'isObject') || isNested(metadata)) {
    return 'not-an-object';
  }
  if (hasValidator(metadata, 'maxLength')) {
    return 'x'.repeat(firstConstraint(metadata, 'maxLength') + 1);
  }
  if (hasValidator(metadata, 'isString') || hasValidator(metadata, 'isNotEmpty')) {
    return 42;
  }

  const designType = Reflect.getMetadata('design:type', contract.dtoClass.prototype, property);
  return designType === String ? 42 : '__invalid__';
}

async function expectAccepts(contract, payload, label) {
  await assert.doesNotReject(
    () => validate(contract.dtoClass, payload),
    `${contractLabel(contract)} should accept ${label}`,
  );
}

async function expectRejects(contract, payload, label) {
  await assert.rejects(
    () => validate(contract.dtoClass, payload),
    (error) => error?.getStatus?.() === 400 || error?.status === 400,
    `${contractLabel(contract)} should reject ${label}`,
  );
}

function validate(dtoClass, payload) {
  return VALIDATION_PIPE.transform(payload, {
    type: 'body',
    metatype: dtoClass,
  });
}

async function validationErrorResponse(dtoClass, payload) {
  try {
    await validate(dtoClass, payload);
  } catch (error) {
    if (typeof error?.getResponse === 'function') {
      return error.getResponse();
    }
    throw error;
  }
  assert.fail(`${dtoClass.name} should fail validation`);
}

function contractForClass(dtoClass) {
  const metadata = getValidationMetadata(dtoClass);
  if (metadata.length === 0) {
    return null;
  }
  return {
    dtoClass,
    exportName: dtoClass.name,
    file: '',
    metadata,
    properties: groupByProperty(metadata),
  };
}

function contractLabel(contract) {
  return `${relative(contract.file)}#${contract.exportName}`;
}

function relative(file) {
  return path.relative(path.join(__dirname, '..'), file).replaceAll(path.sep, '/');
}

describe('Validation DTO contracts', () => {
  const contracts = loadDtoContracts();
  const dtoFiles = new Set(contracts.map((contract) => contract.file));

  it('returns a validation error contract with flat, nested, and forbidden field maps', async () => {
    const { CreateProductDto } = require(path.join(DIST_DIR, 'products/dto/create-product.dto.js'));
    const { CheckoutDto } = require(path.join(DIST_DIR, 'storefront/dto/checkout.dto.js'));
    const { CreateManualOrderDto } = require(
      path.join(DIST_DIR, 'orders/dto/create-manual-order.dto.js'),
    );

    const productResponse = await validationErrorResponse(CreateProductDto, {});
    assert.equal(productResponse.statusCode, 400);
    assert.equal(productResponse.code, 'VALIDATION_ERROR');
    assert.equal(productResponse.message, 'يرجى مراجعة الحقول المطلوبة');
    assert.ok(Array.isArray(productResponse.errors.title));

    const checkoutResponse = await validationErrorResponse(CheckoutDto, {
      cartId: UUID,
      customerName: 'Valid Customer',
      customerPhone: 42,
      extraField: true,
    });
    assert.ok(Array.isArray(checkoutResponse.errors.customerPhone));
    assert.ok(Array.isArray(checkoutResponse.errors.extraField));

    const manualOrderResponse = await validationErrorResponse(CreateManualOrderDto, {
      customerId: UUID,
      paymentMethod: 'cod',
      lines: [{ variantId: UUID, quantity: 0 }],
    });
    assert.ok(Array.isArray(manualOrderResponse.errors['lines.0.quantity']));
  });

  it('covers every built DTO file with validation metadata', () => {
    assert.equal(dtoFiles.size, 221);
    assert.ok(contracts.length >= dtoFiles.size);
  });

  for (const contract of contracts) {
    it(`${contractLabel(contract)} validates request shape`, async () => {
      const validPayload = buildValidPayload(contract);
      await expectAccepts(contract, validPayload, 'a generated valid payload');

      const unknownPayload = { ...validPayload, __unknown: true };
      await expectRejects(contract, unknownPayload, 'unknown properties');

      const requiredProperty = [...contract.properties.entries()].find(
        ([property, metadata]) => !isOptional(metadata) && !hasDefaultValue(contract, property),
      )?.[0];
      if (requiredProperty) {
        const missingPayload = { ...validPayload };
        delete missingPayload[requiredProperty];
        await expectRejects(contract, missingPayload, `missing required ${requiredProperty}`);
      }

      const invalid = invalidPayloadFor(contract);
      await expectRejects(contract, invalid.payload, `invalid ${invalid.property}`);
    });
  }
});
