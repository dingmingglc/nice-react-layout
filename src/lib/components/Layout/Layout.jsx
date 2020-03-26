import React from "react";
import PropTypes from "prop-types";
import reject from "lodash/reject";

// swap array indexes. Work only for flat arrays
const swapArrayIndexes = (arr, index1, index2) => {
  let a = arr.slice(0);
  const buff = a[index1];
  a[index1] = a[index2];
  a[index2] = buff;
  return a;
};

export default class Layout extends React.Component {
  constructor(props) {
    super(props);
    this.layout = React.createRef();
    this.mockupColors = [
      "#ffcccc",
      "#ccffff",
      "#ffe4cc",
      "#ccceff",
      "#fffbcc",
      "#ecccff",
      "#d6ffcc",
      "#ffccf2",
      "#f5ffcc",
      "#ccd6ff",
      "#ffdbcc",
      "#ccf0ff",
      "#ffe9cc",
      "#d8ccff",
      "#fffecc",
      "#f3ccff",
      "#ccffcd",
      "#ffcce9",
      "#eaffcc",
      "#dbccff"
    ];
    let layoutInfo = Layout.calculateLayout(props);
    this.state = {
      collapsedPanels: [], // array of indexes
      draggingPanelIndex: undefined,
      draggingPanelOverIndex: undefined,
      draggingSeparator: false,
      draggingSeparatorIndex: undefined,
      isBusyOnDragging: false, // sidebar dragging throttle
      ...layoutInfo
    };
  }

  static calculateLayout(props) {
    let initialLayout = [];
    let initialOrdering = [];
    let totalFixedWidth = 0;
    let totalFixedHeight = 0;
    let totalSpacerSize = 0;
    React.Children.map(props.children, (c, index) => {
      const { id } = c && c.props;
      if (id === "panel") {
        initialOrdering.push(index);
        if (c.props.fixed) {
          initialLayout.push(0);
          if (c.props.fixedWidth) {
            totalFixedWidth += c.props.fixedWidth;
          } else if (c.props.fixedHeight) {
            totalFixedHeight += c.props.fixedHeight;
          }
        } else {
          initialLayout.push(c.props.proportion);
        }
      } else if (id === "spacer") {
        totalSpacerSize += c.props.size;
      }
    });
    return {
      layout: initialLayout,
      layoutOrdering: initialOrdering,
      totalFixedWidth,
      totalFixedHeight,
      totalSpacerSize
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    let layoutInfo = Layout.calculateLayout(this.props);
    if (layoutInfo.layout.length !== prevState.layout.length) {
      this.setState({...layoutInfo});
    }
  }

  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element),
    className: PropTypes.string,
    customCss: PropTypes.object,
    collapseSize: PropTypes.string,
    mockup: PropTypes.bool,
    orientation: PropTypes.string,
    reverse: PropTypes.bool,
    onResize: PropTypes.func
  };

  static defaultProps = {
    className: "",
    mockup: false,
    orientation: "horizontal",
    reverse: false,
    separatorsRefreshInterval: 0,
    onResize: null
  };

  collapsePanel = layoutIndex => {
    const { collapsedPanels } = this.state;
    if (!collapsedPanels.includes(layoutIndex)) {
      this.setState({ collapsedPanels: collapsedPanels.concat([layoutIndex]) });
    } else {
      this.setState({
        collapsedPanels: reject(collapsedPanels, p => p === layoutIndex)
      });
    }
  };

  draggingOver = layoutIndex => {
    this.setState({ draggingPanelOverIndex: layoutIndex });
  };

  onSeparatorDoubleClick = (draggingSeparatorIndex, defaultDblClickPos) => {
    this.setState({ draggingSeparatorIndex }, () => {
      this.handleSeparatorMouseMove(
        this.props.orientation === "vertical"
          ? { pageY: defaultDblClickPos }
          : { pageX: defaultDblClickPos }
      );
      this.handleSeparatorMouseUp();
    });
  };
  onSeparatorMouseDown = draggingSeparatorIndex => {
    document.addEventListener("mouseup", this.handleSeparatorMouseUp);
    document.addEventListener("mousemove", this.handleSeparatorMouseMove);
    if (this.props.onResize) {
      this.props.onResize(this.state.layout, this.state.collapsedPanels);
    }
    this.setState({ draggingSeparatorIndex });
  };
  handleSeparatorMouseMove = e => {
    const { orientation, reverse, separatorsRefreshInterval } = this.props;
    const rect = this.layout.current.getBoundingClientRect();
    const { top, left, width, height } = rect;
    const {
      draggingSeparatorIndex,
      isBusyOnDragging,
      layout,
      totalFixedWidth,
      totalFixedHeight,
      totalSpacerSize
    } = this.state;
    const newLayout = layout.slice(0);
    if (!isBusyOnDragging) {
      let separatorPos;
      if (reverse) {
        separatorPos =
          orientation === "vertical"
            ? height - (e.clientY - top)
            : width - (e.clientX - left);
      } else {
        separatorPos =
          orientation === "vertical" ? e.clientY - top : e.clientX - left;
      }

      // separator pos limits
      if (separatorPos <= 0) {
        separatorPos = 1;
      } else {
        if (orientation === "vertical" && separatorPos >= height) {
          separatorPos = height;
        } else if (orientation === "horizontal" && separatorPos >= width) {
          separatorPos = width;
        }
      }

      let flexUnitsSum = 0;
      let currentFlexValue = 0;
      const layoutSize =
        orientation === "vertical"
          ? height - totalFixedHeight - totalSpacerSize
          : width - totalFixedWidth - totalSpacerSize;
      newLayout.forEach(panel => {
        flexUnitsSum += panel;
      });
      const newFlexValue = (separatorPos * flexUnitsSum) / layoutSize;
      for (let i = 0; i <= draggingSeparatorIndex; i++) {
        currentFlexValue += newLayout[i];
      }
      const relation = newFlexValue / currentFlexValue;
      for (let i = 0; i <= draggingSeparatorIndex; i++) {
        newLayout[i] = newLayout[i] * relation;
      }
      this.setState({
        draggingSeparator: true,
        layout: newLayout,
        isBusyOnDragging: true
      });
      setTimeout(() => {
        this.setState({ isBusyOnDragging: false });
      }, separatorsRefreshInterval);
    }
  };
  handleSeparatorMouseUp = () => {
    document.removeEventListener("mouseup", this.handleSeparatorMouseUp);
    document.removeEventListener("mousemove", this.handleSeparatorMouseMove);
    this.setState({
      draggingSeparator: false,
      draggingSeparatorIndex: undefined
    });
  };

  startDraggingPanel = panelIndex => {
    this.setState({ draggingPanelIndex: panelIndex });
  };

  stopDraggingPanel = () => {
    // swap panels
    const {
      layoutOrdering,
      draggingPanelIndex,
      draggingPanelOverIndex
    } = this.state;
    if (
      layoutOrdering &&
      draggingPanelIndex !== null &&
      draggingPanelIndex !== undefined &&
      draggingPanelOverIndex !== null &&
      draggingPanelOverIndex !== undefined
    ) {
      const newOrder = swapArrayIndexes(
        layoutOrdering,
        draggingPanelIndex,
        draggingPanelOverIndex
      );
      this.setState({
        draggingPanelIndex: undefined,
        draggingPanelOverIndex: undefined,
        layoutOrdering: newOrder
      });
    } else {
      this.setState({
        draggingPanelIndex: undefined,
        draggingPanelOverIndex: undefined
      });
    }
  };

  render() {
    const {
      children,
      className,
      customCss,
      collapseSize,
      mockup,
      orientation,
      reverse
    } = this.props;
    const {
      collapsedPanels,
      draggingPanelIndex,
      draggingPanelOverIndex,
      draggingSeparator,
      layout,
      layoutOrdering
    } = this.state;
    const styles = {
      horizontalLayout: {
        cursor: draggingSeparator ? "col-resize" : "default",
        display: "flex",
        flexDirection: reverse ? "row-reverse" : "row",
        height: "100%"
      },
      verticalLayout: {
        cursor: draggingSeparator ? "row-resize" : "default",
        display: "flex",
        flexDirection: reverse ? "column-reverse" : "column",
        height: "100%"
      }
    };
    let panelIndex = 0;
    const childrenWithProps = React.Children.map(children, (c, index) => {
      const { id } = c && c.props;
      let child;
      if (id === "separator") {
        child = React.cloneElement(c, {
          disabled:
            (index - 1 === 0 && children[index - 1].props.fixed) ||
            (index + 1 === children.length - 1 &&
              children[index + 1].props.fixed) ||
            (collapsedPanels.includes(index - 1) ||
              collapsedPanels.includes(index + 1)),
          draggingSeparator,
          onSeparatorDoubleClick: this.onSeparatorDoubleClick,
          onSeparatorMouseDown: this.onSeparatorMouseDown,
          orientation,
          layoutIndex: panelIndex - 1
        });
      } else if (id === "panel") {
        if (orientation === "vertical") {
          child = React.cloneElement(c, {
            collapseSize,
            collapsed: collapsedPanels.includes(panelIndex),
            collapsePanel: this.collapsePanel,
            draggingOver: this.draggingOver,
            draggingPanelIndex,
            draggingSeparator,
            flex: c.props.fixed ? "none" : layout[panelIndex],
            height: c.props.fixedHeight,
            isDraggingOver: panelIndex === draggingPanelOverIndex,
            layoutIndex: panelIndex,
            mockupStyle: mockup
              ? { background: this.mockupColors[index] }
              : null,
            order: layoutOrdering[index],
            orientation,
            startDragging: this.startDraggingPanel,
            stopDragging: this.stopDraggingPanel
          });
        } else {
          child = React.cloneElement(c, {
            collapseSize,
            collapsed: collapsedPanels.includes(panelIndex),
            collapsePanel: this.collapsePanel,
            draggingOver: this.draggingOver,
            draggingPanelIndex,
            draggingSeparator,
            width: c.props.fixedWidth,
            flex: c.props.fixed ? "none" : layout[panelIndex],
            isDraggingOver: panelIndex === draggingPanelOverIndex,
            layoutIndex: panelIndex,
            mockupStyle: mockup
              ? {
                background: this.mockupColors[
                this.mockupColors.length - index
                  ]
              }
              : null,
            order: layoutOrdering[index],
            orientation,
            startDragging: this.startDraggingPanel,
            stopDragging: this.stopDraggingPanel
          });
        }
        panelIndex += 1;
      } else if (id === "spacer") {
        child = React.cloneElement(c, {
          orientation
        });
      } else {
        child = c;
      }
      return child;
    });
    return (
      <div
        ref={this.layout}
        style={Object.assign(
          {},
          orientation === "vertical"
            ? styles.verticalLayout
            : styles.horizontalLayout,
          customCss
        )}
        className={className}
      >
        {childrenWithProps}
      </div>
    );
  }
}
