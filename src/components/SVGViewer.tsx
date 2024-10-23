/*
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";


import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { reset } from "react-svg-pan-zoom";
import { Button } from "primereact/button";

// export const Resizable = (args) => {
//   return (
//     <div style={{width: "100%", height: "100%"}}>
//       <ReactSVGPanZoom
//         width={width} height={height}
//         ref={Viewer}
//         value={value} onChangeValue={onChangeValue}
//         tool={tool} onChangeTool={onChangeTool}
//       >
//         <svg width={500} height={500}>
//           <g>
//             <rect x="400" y="40" width="100" height="200" fill="#4286f4" stroke="#f4f142"/>
//             <circle cx="108" cy="108.5" r="100" fill="#0ff" stroke="#0ff"/>
//             <circle cx="180" cy="209.5" r="100" fill="#ff0" stroke="#ff0"/>
//             <circle cx="220" cy="109.5" r="100" fill="#f0f" stroke="#f0f"/>
//           </g>
//         </svg>
//       </ReactSVGPanZoom>
//     </div>
//   )
// }


const Controls = () => {
  const { zoomIn, zoomOut, resetTransform, centerView, zoomToElement } = useControls();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignSelf: 'center',
    }}>
      <Button icon="pi pi-plus" text rounded onClick={() => zoomIn()} />
      <Button icon="pi pi-minus" text rounded onClick={() => zoomOut()} />
      <Button icon="pi pi-arrows-alt" text rounded onClick={(e) => centerView()} />
      <Button icon="pi pi-refresh" text rounded onClick={(e) => resetTransform()} />
    </div>
  );
};

export function SVGViewer({url, className, style}: {url: string, className?: string, style?: CSSProperties}) {
  console.log(url);
  const scale = 1;
  const x = 0;
  const y = 0;
  // const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <TransformWrapper
      initialScale={scale}
      initialPositionX={x}
      initialPositionY={y}
    >
      {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
        <div
          className={className}
          style={style}>
          <Controls />
          <TransformComponent
            wrapperStyle={{
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
            }}
            contentStyle={{
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
            }}
          >
            <img src={url}/>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
};
//*/



//*

import {useWindowSize} from '@react-hook/window-size'
import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';
// INITIAL_VALUE, 
import {ReactSVGPanZoom, TOOL_NONE, fitSelection, zoomOnViewerCenter, fitToViewer, Value, Tool} from 'react-svg-pan-zoom';
import {ReactSvgPanZoomLoader} from 'react-svg-pan-zoom-loader';
import { useControls } from 'react-zoom-pan-pinch';

export function SVGViewer({url, className, style}: {url: string, className?: string, style?: CSSProperties}) {
  // const [lastUrl, setLastUrl] = useState('');
  // const [content, setContent] = useState('');
  const Viewer = useRef<ReactSVGPanZoom>(null);
  const [tool, onChangeTool] = useState<Tool>(TOOL_NONE)
  const [value, onChangeValue] = useState<Value | null>(null);//INITIAL_VALUE)
  const [width, height] = useWindowSize({initialWidth: 400, initialHeight: 400})

  // useLayoutEffect(() => {
  //   Viewer.current?.fitToViewer();
  // }, []);
  
  // if (lastUrl !== url) {
  //   setLastUrl(url);
  //   (async () => setContent(await (await fetch(url)).text()))();
  // }

  return (
    <ReactSvgPanZoomLoader src={url} render= {(content) => (
        <ReactSVGPanZoom 
          className={className}
          style={style} 
          width={width} height={height}
          ref={Viewer}
          toolbarProps={{
            position: 'top',
            SVGAlignX: 'center',
            SVGAlignY: 'center',
          }}
          // miniatureProps={{
          //   position: 'left',
          //   background: '#cccccc',
          //   width: 100,
          //   height: 80,
          // }}
          onDoubleClick={(event) => {
            console.log(event);
            console.log({
              x: event.point.x,
              y: event.point.y,
              scale: event.scaleFactor,
              originalEvent: event.originalEvent,
              originalEventTarget: event.originalEvent.currentTarget,
            });
            Viewer.current?.setPointOnViewerCenter(
              // event.clientX,
              // event.clientY,
              event.point.x,
              event.point.y,
              event.scaleFactor,
              // 1
            );
            console.log('click', event.point.x, event.point.y, event.originalEvent);
          }}
          value={value} onChangeValue={onChangeValue}
          tool={tool} onChangeTool={onChangeTool}>
            <svg >
                {content}
            </svg>
        </ReactSVGPanZoom>
    )}/>
    // <ReactSVGPanZoom
    //   svgXML={content}
    //   className={className}
    //   style={style} 
    //   width={width} height={height}
    //   ref={Viewer}
    //   value={value} onChangeValue={onChangeValue}
    //   tool={tool} onChangeTool={onChangeTool}
    // />
    //   <div
    //     className={className}
    //     style={style} 
    //     dangerouslySetInnerHTML={{__html: content}}/>
    // // </ReactSVGPanZoom>
  );
}
//*/