/**
 * GLSL Color Grade Filter — applied to the full PixiJS stage as a single pass.
 * Controls: brightness, contrast, saturation, temperature, tint.
 * Architecture Rule 5: resolution-agnostic — uniforms are scalar, not pixel-based.
 *
 * Note: method is named 'setValues' (not 'apply') to avoid clashing with
 * PIXI.Filter.apply(filterManager, input, output, clearMode) signature.
 */
import * as PIXI from 'pixi.js'

export type ColorGradeUniforms = {
    brightness: number  // -1.0 to 1.0
    contrast: number  // -1.0 to 1.0
    saturation: number  // -1.0 to 1.0
    temperature: number  // -1.0 to 1.0
    tint: string  // hex color e.g. '#ffffff'
}

function hexToFloat3(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16)
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

const FRAGMENT_SRC = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uTemperature;
  uniform vec3  uTint;

  void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    vec3 rgb = color.rgb;

    rgb += uBrightness;
    rgb = (rgb - 0.5) * (1.0 + uContrast) + 0.5;

    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = mix(vec3(luma), rgb, 1.0 + uSaturation);

    rgb.r += uTemperature * 0.1;
    rgb.b -= uTemperature * 0.1;

    rgb *= mix(vec3(1.0), uTint, 0.3);

    finalColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
  }
`

export class ColorGradeFilter extends PIXI.Filter {
    private _values: ColorGradeUniforms = {
        brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff',
    }

    constructor() {
        super({
            glProgram: PIXI.GlProgram.from({
                fragment: FRAGMENT_SRC,
                vertex: PIXI.defaultFilterVert,
            }),
            resources: {
                uniforms: {
                    uBrightness: { value: 0, type: 'f32' },
                    uContrast: { value: 0, type: 'f32' },
                    uSaturation: { value: 0, type: 'f32' },
                    uTemperature: { value: 0, type: 'f32' },
                    uTint: { value: [1, 1, 1], type: 'vec3<f32>' },
                },
            },
        })
    }

    /** Update color grade uniforms — named setValues to avoid PIXI.Filter.apply() clash */
    setValues(values: Partial<ColorGradeUniforms>): void {
        Object.assign(this._values, values)
        // PixiJS v8: resources.uniforms.uniforms stores values directly (not wrapped in { value })
        const u = (this.resources as unknown as { uniforms: { uniforms: Record<string, unknown> } }).uniforms.uniforms
        u['uBrightness'] = this._values.brightness
        u['uContrast'] = this._values.contrast
        u['uSaturation'] = this._values.saturation
        u['uTemperature'] = this._values.temperature
        u['uTint'] = hexToFloat3(this._values.tint)
    }

    reset(): void {
        this.setValues({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' })
    }
}
