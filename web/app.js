var selected = [];

MiniBarOptions = {
    barType: "default",
    minBarSize: 100,
    alwaysShowBars: true,
};

sigma.classes.graph.addMethod('neighbors', function (nodeId) {
    var k,
        neighbors = {},
        index = this.allNeighborsIndex[nodeId] || {};

    for (k in index)
        neighbors[k] = this.nodesIndex[k];

    return neighbors;
});

// Define a function to map edge weights to colors dynamically
function getEdgeColor(weight, maxWeight) {
    
    // Adjust this function to map your edge weights to colors as needed
    // Here's a simple example: darker colors for higher weights
    var colorScale = ['', '#FFB14E', '#FA8775', '#EA5F94', '#CD34B5', '#9D02D7', '#0000FF', '#00008B'];
    var index = Math.floor(weight / maxWeight * (colorScale.length - 1));
    return colorScale[index];
}

// Initialise sigma with settings
var s = new sigma({
    renderers: [
        {
            type: 'canvas',
            container: document.getElementById('graph-container'),
            freeStyle: true
        }
    ],
    settings: {
        minNodeSize: 1,
        maxNodeSize: 20,
        minEdgeSize: 0.1,
        maxEdgeSize: 3,
        defaultEdgeType: "curve", // only works on canvas renderer
        // labelColor: "node",
        defaultLabelColor: "#2d3937",
        defaultHoverLabelBGColor: "#171c1c",
        defaultLabelHoverColor: "#dffcff",
        font: "Poppins",
        drawLabels: true,
        mouseWheelEnabled: false,
        doubleClickEnabled: false,
        touchEnabled: true,
        
    },
});

// Variable to store the maximum weight
var maxWeight = 0;

// Load data to the graph
sigma.parsers.gexf("everythinggraph.gexf", s,
    function (s) {
        // Iterate over edges to find the maximum weight
        s.graph.edges().forEach(function (e) {
            if (e.weight > maxWeight) {
                maxWeight = e.weight;
            }
        });

        // Add various parameters to nodes and edges
        s.graph.nodes().forEach(function (n) {
            n.label = n.label;
            n.color = getColor(n.attributes["modularity_class"]);
            n.originalColor = n.color;
            n.inactiveColor = "#455454";
            n.selectedColor = "#ffff00";
        });
        s.graph.edges().forEach(function (e) {
            e.originalColor = e.color;
            e.inactiveColor = "0000";
            // Use the getEdgeColor function to assign colors based on edge weights
            e.color = getEdgeColor(e.weight, maxWeight);
        });
        s.refresh();
        populateSearchList(s.graph.nodes());

        // Add event listeners to buttons
        var inputBox = document.getElementById('search-input');
        inputBox.addEventListener("change", searchChange);

        var zoomInButton = document.getElementById('zoom-in-button');
        zoomInButton.addEventListener("click", zoomIn);
        var zoomOutButton = document.getElementById('zoom-out-button');
        zoomOutButton.addEventListener("click", zoomOut);
        
    });

function searchChange(e) {
    var value = e.target.value;

    // Add node to selected
    s.graph.nodes().forEach(function (n) {
        if (n.label == value) {
            if (!selected[n.id]) {
                selected[n.id] = n;
            }
        }
    });
    nodeSelect(s, selected);
}

function zoomIn() {
    var c = s.camera;
    c.goTo({
        ratio: c.ratio / c.settings('zoomingRatio')
    });
}

function zoomOut() {
    var c = s.camera;
    c.goTo({
        ratio: c.ratio * c.settings('zoomingRatio')
    });
}

// Click event for node
s.bind('clickNode', function (e) {
    // Add or remove from selected array
    if (!selected[e.data.node.id]) {
        selected[e.data.node.id] = e.data.node;
    } else {
        delete selected[e.data.node.id];
    }

    nodeSelect(s, selected);
});

// Mouse over event
s.bind('overNode', function (e) {
    nodeHover(s, e.data.node, selected);
});

// Mouse out event
s.bind('outNode', function (e) {
    nodeHoverOut(s, selected);
});

// When the background is clicked, we reset the graph
s.bind('clickStage', function (e) {
    selected = [];
    resetStates(s);
    showSelectedNodes(selected);
    s.refresh();
});

function populateSearchList(nodes) {
    var container = document.getElementById('nodes-datalist');
    nodes.forEach(function (n) {
        var item = document.createElement('option');
        item.value = n.label;
        container.appendChild(item);
    });
}

function getColor(modularityClass) {
    
    // Adjust this function to dynamically generate colors based on the modularity class
    // Here's a simple example using HSL color space to ensure diverse colors, excluding yellow
    var excludedColor = '#FFD700'; // Yellow color code
    var hueStep = 360 / (modularityClass + 2); // Divide the hue range by the number of modularity classes
    var hue = (modularityClass * hueStep) % 360; // Calculate hue based on modularity class
    if (hue < 60) { // Adjust hue to skip yellow
        hue += hueStep;
    }
    return 'hsl(' + hue + ', 100%, 50%)'; // Return HSL color string
}

// Show all selected nodes next to the notes for quick reference
function showSelectedNodes(selected) {
    // Remove old selected nodes
    document.querySelectorAll('.selected-node').forEach(function (a) {
        a.remove()
    });

    if (Object.keys(selected).length > 0) {
        var selected_container = document.getElementById('selected-nodes');
        Object.keys(selected).forEach(function (key) {
            var selected_item = document.createElement("div");
            selected_item.classList.add('selected-node');
            selected_item.innerHTML = selected[key].label;
            selected_container.appendChild(selected_item);
        });
    }
}

// Toggle select a node
function nodeSelect(s, selected) {
    // Making sure we have at least one node selected
    if (Object.keys(selected).length > 0) {
        var toKeep = nodesToKeep(s, selected);

        setSelectedColor(s, selected, toKeep);
        // Grey out irrelevant edges 
        setEdgesToInactive(s, toKeep);
    } else { // If no nodes are selected after click we just reset the graph
        resetStates(s);
    }
    showSelectedNodes(selected);
    s.refresh();
}

// Highlight hovered node and relevant nodes by greying out all else
function nodeHover(s, node, selected) {
    var selectedAndHovered = [];
    // Make a copy of selected and add the hovered node
    Object.assign(selectedAndHovered, selected);
    selectedAndHovered[node.id] = node;
    var toKeep = nodesToKeep(s, selectedAndHovered);

    s.graph.nodes().forEach(function (n) {
        if (toKeep[n.id]) {
            n.color = n.originalColor;
        } else {
            n.color = n.inactiveColor;
        }
    });
    // Grey out irrelevant edges 
    setEdgesToInactive(s, toKeep);
    s.refresh();
}

// Return graph to pre-hover state
function nodeHoverOut() {
    // Start clean, and then figure out what needs to be greyed out according to selected nodes
    resetStates(s);

    if (Object.keys(selected).length > 0) {
        var toKeep = nodesToKeep(s, selected);

        setSelectedColor(s, selected, toKeep);
        setEdgesToInactive(s, toKeep);
    }
    s.refresh();
}

// Reset all selections
function resetStates(s) {
    s.graph.nodes().forEach(function (n) {
        n.color = n.originalColor;
    });
    s.graph.edges().forEach(function (e) {
        e.color = e.originalColor;
    });
}

// Return matching items from two arrays
function returnMatchingArrayItems(array1, array2) {
    retain = [];

    for (var i = 0; i < array1.length; i += 1) {
        if (array2.indexOf(array1[i]) > -1) {
            retain.push(array1[i]);
        }
    }
    return retain;
}

// Return matching nodes from two arrays - 
// for instance when two nodes are selected only common neighbors should be shown
function returnMatchingNodes(array1, array2) {
    var retainKeys = returnMatchingArrayItems(Object.keys(array1), Object.keys(array2)),
        retainNodes = [];

    for (let id of retainKeys) {
        retainNodes[id] = array1[id];
    }
    return retainNodes;
}

// Return all relevant nodes to be kept
function nodesToKeep(s, selected) {
    // Make sure selected is not empty when calling this
    var toKeep,
        i = 0;

    Object.keys(selected).forEach(function (key) {
        if (i == 0) {
            toKeep = s.graph.neighbors(key);
            toKeep[key] = selected[key];
        } else {
            var keep = s.graph.neighbors(key);
            keep[key] = selected[key];
            toKeep = returnMatchingNodes(toKeep, keep);
        }
        i++;
    });
    return toKeep;
}

// Set the color of all selected nodes
function setSelectedColor(s, selected, toKeep) {
    s.graph.nodes().forEach(function (n) {

        if (selected[n.id]) {
            n.color = n.selectedColor;
        }
        else if (!toKeep[n.id]) {
            n.color = n.inactiveColor;
        }
    });
}

// Grey out all edges that are not between active nodes
function setEdgesToInactive(s, nodesToKeep) {
    s.graph.edges().forEach(function (e) {
        if (nodesToKeep[e.source] && nodesToKeep[e.target]) {
            e.color = e.originalColor;
        } else {
            // Set the color of non-connected edges to #0000 to make them invisible
            e.color = '#00000000'; // Note: The correct value for fully transparent is '#00000000' or 'rgba(0,0,0,0)'
        }
    });
}