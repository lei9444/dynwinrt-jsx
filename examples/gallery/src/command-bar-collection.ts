import {
  DynWinRtMethodSig,
  DynWinRtType,
  DynWinRtValue,
  WinGuid,
} from '@microsoft/dynwinrt'

const commandBarElementIid = WinGuid.parse(
  'f8eb20b4-373e-5327-9942-66a1ea21f5f9',
)
const vectorIid = DynWinRtType.parameterized(
  WinGuid.parse('913337e9-11a1-4345-a3a2-4e7f956e222d'),
  [DynWinRtType.interface(commandBarElementIid)],
).iid()
const elementType = DynWinRtType.interface(commandBarElementIid)
let vectorType: ReturnType<typeof DynWinRtType.registerInterface> | null =
  null

function getVectorType() {
  vectorType ??= DynWinRtType.registerInterface(
    'GalleryIVectorICommandBarElement',
    vectorIid,
  )
    .addMethod(
      'GetAt',
      new DynWinRtMethodSig()
        .addIn(DynWinRtType.u32())
        .addOut(elementType),
    )
    .addMethod(
      'get_Size',
      new DynWinRtMethodSig().addOut(DynWinRtType.u32()),
    )
    .addMethod(
      'GetView',
      new DynWinRtMethodSig().addOut(
        DynWinRtType.parameterized(
          WinGuid.parse('bbe1fa4c-b0e3-4583-baef-1f1b2e483e56'),
          [elementType],
        ),
      ),
    )
    .addMethod(
      'IndexOf',
      new DynWinRtMethodSig()
        .addIn(elementType)
        .addOut(DynWinRtType.u32())
        .addOut(DynWinRtType.boolType()),
    )
    .addMethod(
      'SetAt',
      new DynWinRtMethodSig()
        .addIn(DynWinRtType.u32())
        .addIn(elementType),
    )
    .addMethod(
      'InsertAt',
      new DynWinRtMethodSig()
        .addIn(DynWinRtType.u32())
        .addIn(elementType),
    )
    .addMethod(
      'RemoveAt',
      new DynWinRtMethodSig().addIn(DynWinRtType.u32()),
    )
    .addMethod(
      'Append',
      new DynWinRtMethodSig().addIn(elementType),
    )
    .addMethod('RemoveAtEnd', new DynWinRtMethodSig())
    .addMethod('Clear', new DynWinRtMethodSig())
    .addMethod(
      'GetMany',
      new DynWinRtMethodSig()
        .addIn(DynWinRtType.u32())
        .addOutFill(DynWinRtType.arrayType(elementType))
        .addOut(DynWinRtType.u32()),
    )
    .addMethod(
      'ReplaceAll',
      new DynWinRtMethodSig().addIn(
        DynWinRtType.arrayType(elementType),
      ),
    )
  return vectorType
}

interface ProjectedObject {
  readonly _obj: DynWinRtValue
}

function unwrap(value: unknown): DynWinRtValue {
  if (value instanceof DynWinRtValue) {
    return value
  }
  const projected = value as Partial<ProjectedObject>
  if (!projected._obj) {
    throw new TypeError(
      'CommandBar collections accept projected ICommandBarElement values.',
    )
  }
  return projected._obj
}

export class CommandBarCollection {
  readonly #value: DynWinRtValue

  constructor(value: object) {
    // The generated observable-vector declaration omits its mutable IVector
    // specialization, but the underlying WinRT object implements both.
    this.#value = unwrap(value).cast(vectorIid)
  }

  getAt(index: number): DynWinRtValue {
    return getVectorType().method(6).invoke(
      this.#value,
      [DynWinRtValue.u32(index)],
    )
  }

  get size(): number {
    return getVectorType()
      .method(7)
      .invoke(this.#value, [])
      .toNumber()
  }

  get length(): number {
    return this.size
  }

  insertAt(index: number, value: unknown): void {
    getVectorType().method(11).invoke(
      this.#value,
      [DynWinRtValue.u32(index), unwrap(value)],
    )
  }

  removeAt(index: number): void {
    getVectorType().method(12).invoke(
      this.#value,
      [DynWinRtValue.u32(index)],
    )
  }

  append(value: unknown): void {
    getVectorType().method(13).invoke(
      this.#value,
      [unwrap(value)],
    )
  }

  clear(): void {
    getVectorType().method(15).invoke(this.#value, [])
  }
}

export function commandBarCollection(
  value: object,
): CommandBarCollection {
  return new CommandBarCollection(value)
}
