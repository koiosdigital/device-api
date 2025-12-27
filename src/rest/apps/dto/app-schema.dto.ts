import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

export class AppSchemaOptionDto {
  @ApiPropertyOptional({ description: 'Optional display label', example: 'Seattle' })
  display?: string;

  @ApiProperty({ description: 'Primary option label', example: 'Seattle, WA' })
  text!: string;

  @ApiProperty({ description: 'Underlying value used in config', example: 'seattle' })
  value!: string;
}

export class AppSchemaSoundDto {
  @ApiProperty({ description: 'Unique sound identifier', example: 'alert' })
  id!: string;

  @ApiProperty({ description: 'Display title', example: 'Alert Tone' })
  title!: string;

  @ApiProperty({ description: 'Relative file path', example: 'sounds/alert.wav' })
  path!: string;
}

export class AppSchemaVisibilityDto {
  @ApiProperty({
    description: 'Visibility behavior',
    enum: ['invisible', 'disabled'],
    example: 'invisible',
  })
  type!: 'invisible' | 'disabled';

  @ApiProperty({ description: 'Comparison mode', enum: ['equal', 'not_equal'], example: 'equal' })
  condition!: 'equal' | 'not_equal';

  @ApiProperty({ description: 'Source variable used for comparison', example: 'unit' })
  variable!: string;

  @ApiPropertyOptional({ description: 'Value used for comparison', example: 'metric' })
  value?: string;
}

export class AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Field identifier', example: 'city' })
  id!: string;

  @ApiPropertyOptional({ description: 'Human readable label', example: 'City' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Helper text for the field',
    example: 'Pick the city to display',
  })
  description?: string;

  @ApiPropertyOptional({ description: 'Optional icon name', example: 'weather' })
  icon?: string;

  @ApiPropertyOptional({
    description: 'Conditional visibility definition',
    type: () => AppSchemaVisibilityDto,
  })
  visibility?: AppSchemaVisibilityDto;

  @ApiPropertyOptional({ description: 'Default value serialized as text', example: 'seattle' })
  default?: string;

  @ApiPropertyOptional({
    description: 'Selectable options for dropdown style fields',
    type: () => [AppSchemaOptionDto],
  })
  options?: AppSchemaOptionDto[];

  @ApiPropertyOptional({ description: 'Palette of colors for selection fields', type: [String] })
  palette?: string[];

  @ApiPropertyOptional({
    description: 'Available notification sounds',
    type: () => [AppSchemaSoundDto],
  })
  sounds?: AppSchemaSoundDto[];

  @ApiPropertyOptional({
    description: 'Field ID used as a source for generated fields',
    example: 'city',
  })
  source?: string;

  @ApiPropertyOptional({
    description: 'Pixlet handler invoked for dynamic data',
    example: 'fetch_cities',
  })
  handler?: string;

  @ApiPropertyOptional({ description: 'OAuth client identifier', example: 'pixlet-google' })
  client_id?: string;

  @ApiPropertyOptional({
    description: 'OAuth authorization endpoint',
    example: 'https://accounts.google.com/o/oauth2/v2/auth',
  })
  authorization_endpoint?: string;

  @ApiPropertyOptional({
    description: 'OAuth scopes requested for the flow',
    type: [String],
    example: ['profile', 'email'],
  })
  scopes?: string[];
}

export class AppSchemaColorFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for color field', enum: ['color'], example: 'color' })
  type!: 'color';
}

export class AppSchemaDatetimeFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for datetime field',
    enum: ['datetime'],
    example: 'datetime',
  })
  type!: 'datetime';
}

export class AppSchemaDropdownFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for dropdown field',
    enum: ['dropdown'],
    example: 'dropdown',
  })
  type!: 'dropdown';
}

export class AppSchemaGeneratedFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for generated field',
    enum: ['generated'],
    example: 'generated',
  })
  type!: 'generated';
}

export class AppSchemaLocationFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for location field',
    enum: ['location'],
    example: 'location',
  })
  type!: 'location';
}

export class AppSchemaLocationBasedFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for location based field',
    enum: ['locationbased'],
    example: 'locationbased',
  })
  type!: 'locationbased';
}

export class AppSchemaOnOffFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for on/off field', enum: ['onoff'], example: 'onoff' })
  type!: 'onoff';
}

export class AppSchemaRadioFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for radio field', enum: ['radio'], example: 'radio' })
  type!: 'radio';
}

export class AppSchemaTextFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for text field', enum: ['text'], example: 'text' })
  type!: 'text';
}

export class AppSchemaTypeaheadFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for typeahead field',
    enum: ['typeahead'],
    example: 'typeahead',
  })
  type!: 'typeahead';
}

export class AppSchemaOAuth2FieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for OAuth2 field',
    enum: ['oauth2'],
    example: 'oauth2',
  })
  type!: 'oauth2';
}

export class AppSchemaOAuth1FieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for OAuth1 field',
    enum: ['oauth1'],
    example: 'oauth1',
  })
  type!: 'oauth1';
}

export class AppSchemaPNGFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for PNG upload field', enum: ['png'], example: 'png' })
  type!: 'png';
}

export class AppSchemaNotificationFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for notification field',
    enum: ['notification'],
    example: 'notification',
  })
  type!: 'notification';
}

export type AppSchemaFieldDto =
  | AppSchemaColorFieldDto
  | AppSchemaDatetimeFieldDto
  | AppSchemaDropdownFieldDto
  | AppSchemaGeneratedFieldDto
  | AppSchemaLocationFieldDto
  | AppSchemaLocationBasedFieldDto
  | AppSchemaOnOffFieldDto
  | AppSchemaRadioFieldDto
  | AppSchemaTextFieldDto
  | AppSchemaTypeaheadFieldDto
  | AppSchemaOAuth2FieldDto
  | AppSchemaOAuth1FieldDto
  | AppSchemaPNGFieldDto
  | AppSchemaNotificationFieldDto;

export const APP_SCHEMA_FIELD_MODELS = [
  AppSchemaColorFieldDto,
  AppSchemaDatetimeFieldDto,
  AppSchemaDropdownFieldDto,
  AppSchemaGeneratedFieldDto,
  AppSchemaLocationFieldDto,
  AppSchemaLocationBasedFieldDto,
  AppSchemaOnOffFieldDto,
  AppSchemaRadioFieldDto,
  AppSchemaTextFieldDto,
  AppSchemaTypeaheadFieldDto,
  AppSchemaOAuth2FieldDto,
  AppSchemaOAuth1FieldDto,
  AppSchemaPNGFieldDto,
  AppSchemaNotificationFieldDto,
] as const;

const APP_SCHEMA_FIELD_TYPE_MAP = {
  color: AppSchemaColorFieldDto,
  datetime: AppSchemaDatetimeFieldDto,
  dropdown: AppSchemaDropdownFieldDto,
  generated: AppSchemaGeneratedFieldDto,
  location: AppSchemaLocationFieldDto,
  locationbased: AppSchemaLocationBasedFieldDto,
  onoff: AppSchemaOnOffFieldDto,
  radio: AppSchemaRadioFieldDto,
  text: AppSchemaTextFieldDto,
  typeahead: AppSchemaTypeaheadFieldDto,
  oauth2: AppSchemaOAuth2FieldDto,
  oauth1: AppSchemaOAuth1FieldDto,
  png: AppSchemaPNGFieldDto,
  notification: AppSchemaNotificationFieldDto,
} as const;

const schemaFieldOneOf = APP_SCHEMA_FIELD_MODELS.map((model) => ({
  $ref: getSchemaPath(model),
}));

const schemaFieldDiscriminator = {
  propertyName: 'type',
  mapping: Object.entries(APP_SCHEMA_FIELD_TYPE_MAP).reduce<Record<string, string>>(
    (acc, [key, model]) => {
      acc[key] = getSchemaPath(model);
      return acc;
    },
    {}
  ),
};

export class AppSchemaDto {
  @ApiProperty({ description: 'Schema version', example: '1.0.0' })
  version!: string;

  @ApiProperty({
    description: 'List of configurable fields (empty array if no configuration required)',
    type: 'array',
    items: {
      oneOf: schemaFieldOneOf,
      discriminator: schemaFieldDiscriminator,
    },
  })
  schema!: AppSchemaFieldDto[];

  @ApiPropertyOptional({
    description: 'Notification field definitions',
    type: 'array',
    items: {
      $ref: getSchemaPath(AppSchemaNotificationFieldDto),
    },
  })
  notifications?: AppSchemaNotificationFieldDto[];
}
