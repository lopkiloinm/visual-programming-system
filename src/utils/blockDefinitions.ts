import { BlockCategory } from '../types/blocks';

export const blockCategories: BlockCategory[] = [
  {
    name: 'Events',
    color: '#dc2626',
    blocks: [
      {
        id: 'when_setup',
        label: 'when setup',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: '${content}' // Content will be placed in setup() function
      },
      {
        id: 'when_draw',
        label: 'when draw (loop)',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: '${content}' // Content will be placed directly in draw() or drawSprites()
      },
      {
        id: 'when_clicked',
        label: 'when clicked',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: 'function mousePressed() {\n${content}\n}'
      },
      {
        id: 'when_sprite_clicked',
        label: 'when sprite clicked',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: 'if (sprites[0].mouse.pressing()) {\n${content}\n}'
      }
    ]
  },
  {
    name: 'Control',
    color: '#7c3aed',
    blocks: [
      {
        id: 'repeat_forever',
        label: 'repeat forever',
        category: 'Control',
        color: '#7c3aed',
        type: 'control',
        code: '${content}' // This will be handled by async loops
      },
      {
        id: 'if_condition',
        label: 'if',
        category: 'Control',
        color: '#7c3aed',
        type: 'action',
        height: 'tall',
        code: 'if (${condition}) {\n  ${then}\n} else {\n  ${else}\n}',
        labeledConnections: {
          inputs: [
            { label: 'condition', side: 'left', type: 'boolean' }
          ],
          outputs: [
            { label: 'then', side: 'right', type: 'flow' },
            { label: 'else', side: 'right', type: 'flow' }
          ]
        }
      },
      {
        id: 'while_loop',
        label: 'while',
        category: 'Control',
        color: '#7c3aed',
        type: 'action',
        height: 'tall',
        code: 'while (${condition}) {\n  ${do}\n}',
        labeledConnections: {
          inputs: [
            { label: 'condition', side: 'left', type: 'boolean' }
          ],
          outputs: [
            { label: 'do', side: 'right', type: 'flow' }
          ]
        }
      },
      {
        id: 'repeat_times',
        label: 'repeat',
        category: 'Control',
        color: '#7c3aed',
        type: 'action',
        height: 'medium',
        inputs: [
          { type: 'number', name: 'times', defaultValue: 10 }
        ],
        code: 'for (let i = 0; i < ${times}; i++) {\n  ${do}\n}',
        labeledConnections: {
          outputs: [
            { label: 'do', side: 'right', type: 'flow' }
          ]
        }
      },
      {
        id: 'wait_frames',
        label: 'wait frames',
        category: 'Control',
        color: '#7c3aed',
        type: 'action',
        inputs: [
          { type: 'number', name: 'frames', defaultValue: 30 }
        ],
        code: 'await waitFrames(${frames});'
      }
    ]
  },
  {
    name: 'Drawing',
    color: '#059669',
    blocks: [
      {
        id: 'draw_circle',
        label: 'draw circle at mouse',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        code: 'circle((window.globalMouseX || 0), (window.globalMouseY || 0), 50);'
      },
      {
        id: 'set_fill',
        label: 'set fill color',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'red' }
        ],
        code: 'fill("${color}");'
      },
      {
        id: 'set_background',
        label: 'set background color',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'lightblue' }
        ],
        code: 'background("${color}");'
      },
      {
        id: 'draw_rect',
        label: 'draw rectangle',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 100 },
          { type: 'number', name: 'y', defaultValue: 100 },
          { type: 'number', name: 'w', defaultValue: 50 },
          { type: 'number', name: 'h', defaultValue: 50 }
        ],
        code: 'rect(${x}, ${y}, ${w}, ${h});'
      },
      {
        id: 'draw_circle_at',
        label: 'draw circle at position',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 0 },
          { type: 'number', name: 'y', defaultValue: 0 },
          { type: 'number', name: 'size', defaultValue: 30 }
        ],
        code: 'circle(${x}, ${y}, ${size});'
      },
      {
        id: 'draw_sprite_circle',
        label: 'draw circle at sprite',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'number', name: 'size', defaultValue: 30 }
        ],
        code: 'circle(sprites[0].x, sprites[0].y, ${size});'
      },
      {
        id: 'draw_trail',
        label: 'draw trail behind sprite',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'blue' },
          { type: 'number', name: 'size', defaultValue: 5 }
        ],
        code: 'fill("${color}"); circle(sprites[0].x, sprites[0].y, ${size});'
      }
    ]
  },
  {
    name: 'Motion',
    color: '#2563eb',
    blocks: [
      {
        id: 'move_sprite',
        label: 'move sprite by',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 10 },
          { type: 'number', name: 'y', defaultValue: 10 }
        ],
        code: 'updateSprite(sprites[0].id, {x: sprites[0].x + ${x}, y: sprites[0].y + ${y}});'
      },
      {
        id: 'set_sprite_position',
        label: 'set sprite position',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 0 },
          { type: 'number', name: 'y', defaultValue: 0 }
        ],
        code: 'updateSprite(sprites[0].id, {x: ${x}, y: ${y}});'
      },
      {
        id: 'move_to_mouse',
        label: 'move sprite to mouse',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        code: 'updateSprite(sprites[0].id, {x: (window.globalMouseX || 0), y: (window.globalMouseY || 0)});'
      },
      {
        id: 'glide_to_position',
        label: 'glide to position',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 0 },
          { type: 'number', name: 'y', defaultValue: 0 },
          { type: 'number', name: 'speed', defaultValue: 2 }
        ],
        code: 'sprites[0].moveTo(${x}, ${y}, ${speed});'
      },
      {
        id: 'glide_to_mouse',
        label: 'glide to mouse',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'speed', defaultValue: 2 }
        ],
        code: 'sprites[0].moveTo((window.globalMouseX || 0), (window.globalMouseY || 0), ${speed});'
      },
      {
        id: 'set_velocity',
        label: 'set velocity',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'vx', defaultValue: 5 },
          { type: 'number', name: 'vy', defaultValue: 0 }
        ],
        code: 'sprites[0].setVelocity(${vx}, ${vy});'
      },
      {
        id: 'bounce_edges',
        label: 'bounce off edges',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        code: 'const halfWidth = width/2; const halfHeight = height/2; if (sprites[0].x < -halfWidth || sprites[0].x > halfWidth) sprites[0].vel.x *= -1; if (sprites[0].y < -halfHeight || sprites[0].y > halfHeight) sprites[0].vel.y *= -1;'
      },
      {
        id: 'change_sprite_color',
        label: 'change sprite color',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'red' }
        ],
        code: 'updateSprite(sprites[0].id, {color: "${color}"});'
      },
      {
        id: 'change_sprite_size',
        label: 'change sprite size',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'size', defaultValue: 50 }
        ],
        code: 'updateSprite(sprites[0].id, {size: ${size}});'
      },
      {
        id: 'rotate_sprite',
        label: 'rotate sprite',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'angle', defaultValue: 45 }
        ],
        code: 'sprites[0].rotation += ${angle};'
      },
      {
        id: 'point_towards_mouse',
        label: 'point towards mouse',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        code: 'sprites[0].rotation = atan2((window.globalMouseY || 0) - sprites[0].y, (window.globalMouseX || 0) - sprites[0].x) * 180 / PI;'
      }
    ]
  },
  {
    name: 'Physics',
    color: '#f59e0b',
    blocks: [
      {
        id: 'enable_physics',
        label: 'enable physics',
        category: 'Physics',
        color: '#f59e0b',
        type: 'action',
        code: 'sprites[0].collider = "dynamic";'
      },
      {
        id: 'disable_physics',
        label: 'disable physics',
        category: 'Physics',
        color: '#f59e0b',
        type: 'action',
        code: 'sprites[0].collider = "none";'
      },
      {
        id: 'apply_force',
        label: 'apply force',
        category: 'Physics',
        color: '#f59e0b',
        type: 'action',
        inputs: [
          { type: 'number', name: 'fx', defaultValue: 0 },
          { type: 'number', name: 'fy', defaultValue: -10 }
        ],
        code: 'sprites[0].applyForce(${fx}, ${fy});'
      },
      {
        id: 'set_gravity',
        label: 'set gravity',
        category: 'Physics',
        color: '#f59e0b',
        type: 'action',
        inputs: [
          { type: 'number', name: 'gravity', defaultValue: 10 }
        ],
        code: 'world.gravity.y = ${gravity};'
      },
      {
        id: 'bounce_sprite',
        label: 'make sprite bouncy',
        category: 'Physics',
        color: '#f59e0b',
        type: 'action',
        inputs: [
          { type: 'number', name: 'bounciness', defaultValue: 0.8 }
        ],
        code: 'sprites[0].bounciness = ${bounciness};'
      },
      {
        id: 'set_friction',
        label: 'set sprite friction',
        category: 'Physics',
        color: '#f59e0b',
        type: 'action',
        inputs: [
          { type: 'number', name: 'friction', defaultValue: 0.1 }
        ],
        code: 'sprites[0].friction = ${friction};'
      }
    ]
  },
  {
    name: 'Sensing',
    color: '#8b5cf6',
    blocks: [
      {
        id: 'touching_mouse',
        label: 'touching mouse?',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: 'sprites[0].mouse.hovering()',
        labeledConnections: {
          outputs: [
            { label: 'touching', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'mouse_x',
        label: 'mouse x',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: '(window.globalMouseX || 0)',
        labeledConnections: {
          outputs: [
            { label: 'x', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'mouse_y',
        label: 'mouse y',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: '(window.globalMouseY || 0)',
        labeledConnections: {
          outputs: [
            { label: 'y', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'sprite_x',
        label: 'sprite x position',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: 'sprites[0].x',
        labeledConnections: {
          outputs: [
            { label: 'x', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'sprite_y',
        label: 'sprite y position',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: 'sprites[0].y',
        labeledConnections: {
          outputs: [
            { label: 'y', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'distance_to_mouse',
        label: 'distance to mouse',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: 'dist(sprites[0].x, sprites[0].y, (window.globalMouseX || 0), (window.globalMouseY || 0))',
        labeledConnections: {
          outputs: [
            { label: 'distance', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'sprite_speed',
        label: 'sprite speed',
        category: 'Sensing',
        color: '#8b5cf6',
        type: 'value',
        code: 'sprites[0].speed',
        labeledConnections: {
          outputs: [
            { label: 'speed', side: 'right', type: 'number' }
          ]
        }
      }
    ]
  },
  {
    name: 'Effects',
    color: '#ec4899',
    blocks: [
      {
        id: 'fade_sprite',
        label: 'fade sprite',
        category: 'Effects',
        color: '#ec4899',
        type: 'action',
        inputs: [
          { type: 'number', name: 'opacity', defaultValue: 128 }
        ],
        code: 'updateSprite(sprites[0].id, {opacity: ${opacity}});'
      },
      {
        id: 'hide_sprite',
        label: 'hide sprite',
        category: 'Effects',
        color: '#ec4899',
        type: 'action',
        code: 'updateSprite(sprites[0].id, {visible: false});'
      },
      {
        id: 'show_sprite',
        label: 'show sprite',
        category: 'Effects',
        color: '#ec4899',
        type: 'action',
        code: 'updateSprite(sprites[0].id, {visible: true});'
      },
      {
        id: 'scale_sprite',
        label: 'scale sprite',
        category: 'Effects',
        color: '#ec4899',
        type: 'action',
        inputs: [
          { type: 'number', name: 'scale', defaultValue: 1.5 }
        ],
        code: 'updateSprite(sprites[0].id, {scale: ${scale}});'
      },
      {
        id: 'tint_sprite',
        label: 'tint sprite',
        category: 'Effects',
        color: '#ec4899',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'red' }
        ],
        code: 'updateSprite(sprites[0].id, {tint: "${color}"});'
      },
      {
        id: 'remove_tint',
        label: 'remove tint',
        category: 'Effects',
        color: '#ec4899',
        type: 'action',
        code: 'updateSprite(sprites[0].id, {tint: null});'
      }
    ]
  },
  {
    name: 'Logic',
    color: '#16a34a',
    blocks: [
      {
        id: 'boolean_true',
        label: 'true',
        category: 'Logic',
        color: '#16a34a',
        type: 'value',
        code: 'true',
        labeledConnections: {
          outputs: [
            { label: 'true', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'boolean_false',
        label: 'false',
        category: 'Logic',
        color: '#16a34a',
        type: 'value',
        code: 'false',
        labeledConnections: {
          outputs: [
            { label: 'false', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'and_operator',
        label: 'and',
        category: 'Logic',
        color: '#16a34a',
        type: 'value',
        height: 'medium',
        code: '(${A} && ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'boolean' },
            { label: 'B', side: 'left', type: 'boolean' }
          ],
          outputs: [
            { label: 'result', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'or_operator',
        label: 'or',
        category: 'Logic',
        color: '#16a34a',
        type: 'value',
        height: 'medium',
        code: '(${A} || ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'boolean' },
            { label: 'B', side: 'left', type: 'boolean' }
          ],
          outputs: [
            { label: 'result', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'not_operator',
        label: 'not',
        category: 'Logic',
        color: '#16a34a',
        type: 'value',
        height: 'medium',
        code: '(!${value})',
        labeledConnections: {
          inputs: [
            { label: 'value', side: 'left', type: 'boolean' }
          ],
          outputs: [
            { label: 'not', side: 'right', type: 'boolean' }
          ]
        }
      }
    ]
  },
  {
    name: 'Math',
    color: '#ea580c',
    blocks: [
      {
        id: 'add_numbers',
        label: '+',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} + ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'sum', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'subtract_numbers',
        label: '-',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} - ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'A-B', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'multiply_numbers',
        label: '×',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} * ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'A×B', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'divide_numbers',
        label: '÷',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} / ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'A÷B', side: 'right', type: 'number' }
          ]
        }
      },
      {
        id: 'equals_comparison',
        label: '=',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} === ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'A=B', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'greater_than',
        label: '>',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} > ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'A>B', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'less_than',
        label: '<',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        height: 'medium',
        code: '(${A} < ${B})',
        labeledConnections: {
          inputs: [
            { label: 'A', side: 'left', type: 'number' },
            { label: 'B', side: 'left', type: 'number' }
          ],
          outputs: [
            { label: 'A<B', side: 'right', type: 'boolean' }
          ]
        }
      },
      {
        id: 'number_value',
        label: 'number',
        category: 'Math',
        color: '#ea580c',
        type: 'value',
        inputs: [
          { type: 'number', name: 'value', defaultValue: 0 }
        ],
        code: '${value}',
        labeledConnections: {
          outputs: [
            { label: 'value', side: 'right', type: 'number' }
          ]
        }
      }
    ]
  }
];