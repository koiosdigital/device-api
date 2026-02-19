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
}

export class AppSchemaColorFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for color field', enum: ['color'], example: 'color' })
  type!: 'color';

  @ApiPropertyOptional({ description: 'Palette of colors for selection fields', type: [String] })
  palette?: string[];
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

  @ApiProperty({
    description: 'Selectable options',
    type: () => [AppSchemaOptionDto],
  })
  options!: AppSchemaOptionDto[];
}

export class AppSchemaGeneratedFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for generated field',
    enum: ['generated'],
    example: 'generated',
  })
  type!: 'generated';

  @ApiProperty({ description: 'Field ID used as source for generated fields', example: 'city' })
  source!: string;

  @ApiProperty({ description: 'Pixlet handler invoked for dynamic data', example: 'fetch_cities' })
  handler!: string;
}

export class AppSchemaLocationValueDto {
  @ApiProperty({ description: 'Latitude coordinate', example: '40.6781784' })
  lat!: string;

  @ApiProperty({ description: 'Longitude coordinate', example: '-73.9441579' })
  lng!: string;

  @ApiProperty({ description: 'Human readable location description', example: 'Brooklyn, NY, USA' })
  description!: string;

  @ApiProperty({ description: 'Locality name', example: 'Brooklyn' })
  locality!: string;

  @ApiProperty({ description: 'Google Places ID', example: 'ChIJCSF8lBZEwokRhngABHRcdoI' })
  place_id!: string;

  @ApiProperty({ description: 'IANA timezone identifier', example: 'America/New_York' })
  timezone!: string;
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

  @ApiProperty({
    description: 'Pixlet handler invoked with location JSON to generate options',
    example: 'fetch_options',
  })
  handler!: string;
}

export class AppSchemaOnOffFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for on/off field', enum: ['onoff'], example: 'onoff' })
  type!: 'onoff';
}

export class AppSchemaRadioFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({ description: 'Discriminator for radio field', enum: ['radio'], example: 'radio' })
  type!: 'radio';

  @ApiProperty({
    description: 'Selectable options',
    type: () => [AppSchemaOptionDto],
  })
  options!: AppSchemaOptionDto[];
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

  @ApiProperty({
    description: 'Pixlet handler invoked with search pattern to generate options',
    example: 'search_handler',
  })
  handler!: string;
}

export class AppSchemaOAuth2FieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for OAuth2 field',
    enum: ['oauth2'],
    example: 'oauth2',
  })
  type!: 'oauth2';

  @ApiProperty({ description: 'Pixlet handler invoked for dynamic data', example: 'oauth_handler' })
  handler!: string;

  @ApiPropertyOptional({ description: 'OAuth client identifier', example: 'pixlet-google' })
  client_id?: string;

  @ApiPropertyOptional({
    description:
      'Indicates if PKCE is used, S256 method will be used if true, and the handler will receive an additional code_verifier parameter.',
    example: true,
  })
  pkce?: boolean;

  @ApiProperty({
    description: 'OAuth authorization endpoint',
    example: 'https://accounts.google.com/o/oauth2/v2/auth',
  })
  authorization_endpoint!: string;

  @ApiProperty({
    description: 'OAuth scopes requested for the flow',
    type: [String],
    example: ['profile', 'email'],
  })
  scopes!: string[];

  @ApiPropertyOptional({
    description:
      'If true, the user provides their own OAuth client credentials. Mutually exclusive with client_id.',
    example: false,
  })
  user_defined_client?: boolean;
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

  @ApiProperty({
    description: 'Available notification sounds',
    type: () => [AppSchemaSoundDto],
  })
  sounds!: AppSchemaSoundDto[];
}

export class AppSchemaGeoJSONFieldDto extends AppSchemaFieldBaseDto {
  @ApiProperty({
    description: 'Discriminator for GeoJSON field',
    enum: ['geojson'],
    example: 'geojson',
  })
  type!: 'geojson';

  @ApiPropertyOptional({
    description: 'If true, enables point collection on the map UI in addition to polygon drawing',
    example: true,
  })
  collect_point?: boolean;
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
  | AppSchemaNotificationFieldDto
  | AppSchemaGeoJSONFieldDto;

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
  AppSchemaGeoJSONFieldDto,
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
  geojson: AppSchemaGeoJSONFieldDto,
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
